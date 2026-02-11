import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import {
  uploadFile,
  validateMultipartRequest,
  getFileFromFormData,
} from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";

const CATEGORIES = ["sheet", "handle", "hardware", "accessory", "edging_tape"];

export async function POST(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Validate and parse multipart/form-data
    const formData = await validateMultipartRequest(request);

    const description = formData.get("description");
    const price = formData.get("price");
    const quantity = formData.get("quantity");
    const imageFile = getFileFromFormData(formData, "image");
    const category = formData.get("category").toLowerCase();
    const brand = formData.get("brand");
    const color = formData.get("color");
    const finish = formData.get("finish");
    const face = formData.get("face");
    const dimensions = formData.get("dimensions");
    const type = formData.get("type");
    const material = formData.get("material");
    const name = formData.get("name");
    const sub_category = (formData.get("sub_category") || "").toLowerCase();
    const measurement_unit = formData.get("measurement_unit");

    // Parse suppliers array from JSON (new multi-supplier support)
    const suppliersJson = formData.get("suppliers");
    let suppliers = [];
    if (suppliersJson) {
      try {
        suppliers = JSON.parse(suppliersJson);
      } catch (e) {
        return NextResponse.json(
          {
            status: false,
            message: "Invalid suppliers format - must be valid JSON array",
          },
          { status: 400 },
        );
      }
    }

    // Handle is_sunmica - FormData sends booleans as strings
    const is_sunmicaValue = formData.get("is_sunmica");
    const is_sunmica =
      is_sunmicaValue === "true" ||
      is_sunmicaValue === true ||
      is_sunmicaValue === "1";

    if (!CATEGORIES.includes(category)) {
      return NextResponse.json(
        { status: false, message: "Invalid category" },
        { status: 400 },
      );
    }

    // Prepare category-specific data based on category type
    let categoryData = {};
    if (category === "sheet") {
      categoryData = {
        sheet: {
          create: {
            brand,
            color,
            finish,
            face,
            dimensions,
            is_sunmica: is_sunmica || false,
          },
        },
      };
    } else if (category === "handle") {
      categoryData = {
        handle: {
          create: {
            brand,
            color,
            type,
            dimensions,
            material,
          },
        },
      };
    } else if (category === "hardware") {
      categoryData = {
        hardware: {
          create: {
            brand,
            name,
            type,
            dimensions,
            sub_category,
          },
        },
      };
    } else if (category === "accessory") {
      categoryData = {
        accessory: {
          create: {
            name,
          },
        },
      };
    } else if (category === "edging_tape") {
      categoryData = {
        edging_tape: {
          create: {
            brand,
            color,
            finish,
            dimensions,
          },
        },
      };
    }

    // Prepare itemSuppliers data from suppliers array
    let itemSuppliersData = [];
    if (suppliers && suppliers.length > 0) {
      itemSuppliersData = suppliers.map((s) => ({
        supplier_id: s.supplier_id,
        supplier_reference: s.supplier_reference || null,
        supplier_product_link: s.supplier_product_link || null,
        price: s.price ? parseFloat(s.price) : null,
      }));
    }

    // Use transaction to atomically create item and category-specific record
    // This prevents "ghost items" if category creation fails
    const createdItem = await prisma.$transaction(async (tx) => {
      // Create item with nested category-specific record in a single atomic operation
      return await tx.item.create({
        data: {
          description,
          // Keep old fields for backward compatibility (will be removed later)
          price: price ? parseFloat(price) : null,
          quantity: quantity ? parseFloat(quantity) : null,
          category: category.toUpperCase(),
          measurement_unit: measurement_unit || null,
          ...categoryData,
          // Add itemSuppliers relation
          ...(itemSuppliersData.length > 0 && {
            itemSuppliers: {
              create: itemSuppliersData,
            },
          }),
        },
        include: {
          sheet: true,
          handle: true,
          hardware: true,
          accessory: true,
          edging_tape: true,
          itemSuppliers: {
            include: {
              supplier: true,
            },
          },
        },
      });
    });

    let imageId = null;

    // Handle file upload if image is provided
    // This happens after the transaction to avoid file system operations in the transaction
    if (imageFile) {
      try {
        // Upload file with ID-based naming
        const uploadResult = await uploadFile(imageFile, {
          uploadDir: "mediauploads",
          subDir: `items/${category}`,
          filenameStrategy: "id-based",
          idPrefix: createdItem.item_id,
        });

        // Create media record and update item with image_id in a transaction
        await prisma.$transaction(async (tx) => {
          const media = await tx.media.create({
            data: {
              url: uploadResult.relativePath,
              filename: uploadResult.originalFilename,
              file_type: uploadResult.fileType,
              mime_type: uploadResult.mimeType,
              extension: uploadResult.extension,
              size: uploadResult.size,
              item_id: createdItem.item_id,
            },
          });

          imageId = media.id;

          await tx.item.update({
            where: { item_id: createdItem.item_id },
            data: { image_id: imageId },
          });
        });
      } catch (error) {
        console.error("Error handling image upload:", error);
        console.error("Upload error details:", {
          message: error.message,
          stack: error.stack,
          imageFile: imageFile
            ? {
                name: imageFile.name,
                size: imageFile.size,
                type: imageFile.type,
              }
            : null,
        });
        // Return error instead of silently failing
        return NextResponse.json(
          {
            status: false,
            message: "Failed to upload image",
            error: error.message,
          },
          { status: 500 },
        );
      }
    }

    // Fetch the updated item with image relation (if image was uploaded)
    const updatedItem = await prisma.item.findUnique({
      where: { item_id: createdItem.item_id },
      include: {
        image: true,
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
        itemSuppliers: {
          include: {
            supplier: true,
          },
        },
      },
    });

    // Log the creation
    const itemDescription = description || `Item (${category})`;
    const logged = await withLogging(
      request,
      "item",
      createdItem.item_id,
      "CREATE",
      `Item created successfully: ${itemDescription}`,
    );
    if (!logged) {
      console.error(
        `Failed to log item creation: ${createdItem.item_id} - ${itemDescription}`,
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Item created successfully",
        ...(logged
          ? {}
          : { warning: "Note: Creation succeeded but logging failed" }),
        data: updatedItem,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create item error:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
      },
      { status: 500 },
    );
  }
}
