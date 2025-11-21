import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import {
  uploadFile,
  validateMultipartRequest,
  getFileFromFormData,
} from "@/lib/fileHandler";
import { withLogging } from "../../../../../lib/withLogging";

const CATEGORIES = ["sheet", "handle", "hardware", "accessory", "edging_tape"];

export async function POST(request, { params }) {
  try {
    const admin = await isAdmin(request);
    if (!admin) {
      return NextResponse.json(
        { status: false, message: "Unauthorized" },
        { status: 401 }
      );
    }
    if (await isSessionExpired(request)) {
      return NextResponse.json(
        { status: false, message: "Session expired" },
        { status: 401 }
      );
    }

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
    const supplier_id = formData.get("supplier_id");
    const measurement_unit = formData.get("measurement_unit");
    const supplier_reference = formData.get("supplier_reference");
    const supplier_product_link = formData.get("supplier_product_link");
    // Handle is_sunmica - FormData sends booleans as strings
    const is_sunmicaValue = formData.get("is_sunmica");
    const is_sunmica =
      is_sunmicaValue === "true" ||
      is_sunmicaValue === true ||
      is_sunmicaValue === "1";

    if (!CATEGORIES.includes(category)) {
      return NextResponse.json(
        { status: false, message: "Invalid category" },
        { status: 400 }
      );
    }

    // Create base item first to obtain item_id
    const createdItem = await prisma.item.create({
      data: {
        description,
        price: price ? parseFloat(price) : null,
        quantity: quantity ? parseInt(quantity) : null,
        category: category.toUpperCase(),
        supplier_id: supplier_id || null,
        measurement_unit: measurement_unit || null,
        supplier_reference: supplier_reference || null,
        supplier_product_link: supplier_product_link || null,
      },
    });

    let imageId = null;

    // Handle file upload if image is provided
    if (imageFile) {
      try {
        // Upload file with ID-based naming
        const uploadResult = await uploadFile(imageFile, {
          uploadDir: "uploads",
          subDir: `items/${category}`,
          filenameStrategy: "id-based",
          idPrefix: createdItem.item_id,
        });

        // Create media record
        const media = await prisma.media.create({
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

        // Update item with image_id
        await prisma.item.update({
          where: { item_id: createdItem.item_id },
          data: { image_id: imageId },
        });
      } catch (error) {
        console.error("Error handling image upload:", error);
        // Continue without image if upload fails
        // Item is already created, so we don't fail the whole request
      }
    }

    // Create category-specific record using item_id
    let sheet;
    let handle;
    let hardware;
    let accessory;
    let edging_tape;
    if (category === "sheet") {
      sheet = await prisma.sheet.create({
        data: {
          item_id: createdItem.item_id,
          brand,
          color,
          finish,
          face,
          dimensions,
          is_sunmica: is_sunmica || false,
        },
      });
    } else if (category === "handle") {
      handle = await prisma.handle.create({
        data: {
          item_id: createdItem.item_id,
          brand,
          color,
          type,
          dimensions,
          material,
        },
      });
    } else if (category === "hardware") {
      hardware = await prisma.hardware.create({
        data: {
          item_id: createdItem.item_id,
          brand,
          name,
          type,
          dimensions,
          sub_category,
        },
      });
    } else if (category === "accessory") {
      accessory = await prisma.accessory.create({
        data: {
          item_id: createdItem.item_id,
          name,
        },
      });
    } else if (category === "edging_tape") {
      edging_tape = await prisma.edging_tape.create({
        data: {
          item_id: createdItem.item_id,
          brand,
          color,
          finish,
          dimensions,
        },
      });
    }

    // Fetch the updated item with image relation
    const updatedItem = await prisma.item.findUnique({
      where: { item_id: createdItem.item_id },
      include: {
        image: true,
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
      },
    });
    const logged = await withLogging(
      request,
      "item",
      createdItem.item_id,
      "CREATE",
      `Item created successfully: ${createdItem.name}`
    );
    if (!logged) {
      return NextResponse.json(
        { status: false, message: "Failed to log item creation" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Item created successfully",
        data: updatedItem,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create item error:", error);
    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
