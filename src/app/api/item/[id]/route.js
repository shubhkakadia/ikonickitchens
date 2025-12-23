import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { validateAdminAuth } from "@/lib/validators/authFromToken";
import {
  uploadFile,
  deleteFileByRelativePath,
  getFileFromFormData,
} from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const item = await prisma.item.findFirst({
      where: {
        item_id: id,
        is_deleted: false,
      },
      include: {
        image: true,
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
        supplier: true,
        materials_to_order_items: true,
        purchase_order_item: true,
      },
    });

    if (!item) {
      return NextResponse.json(
        { status: false, message: "Item not found" },
        { status: 404 }
      );
    }

    // Fetch stock transactions separately for all types (ADDED, USED, WASTED)
    const stock_transactions = await prisma.stock_transaction.findMany({
      where: { item_id: id },
      include: {
        purchase_order: {
          select: {
            order_no: true,
          },
        },
        materials_to_order: {
          include: {
            project: {
              select: {
                name: true,
              },
            },
            lots: {
              select: {
                lot_id: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Attach stock_transactions to item
    const itemWithTransactions = {
      ...item,
      stock_transactions,
    };

    return NextResponse.json(
      {
        status: true,
        message: "Item fetched successfully",
        data: itemWithTransactions,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in GET /api/item/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    let formData;
    try {
      formData = await request.formData();
    } catch (parseError) {
      console.error("FormData parse error:", parseError);
      return NextResponse.json(
        {
          status: false,
          message: "Failed to parse form data",
          error: parseError.message,
        },
        { status: 400 }
      );
    }
    const { id } = await params;

    const description = formData.get("description");
    const price = formData.get("price");
    const quantity = formData.get("quantity");
    const imageFile = getFileFromFormData(formData, "image");
    const brand = formData.get("brand");
    const color = formData.get("color");
    const finish = formData.get("finish");
    const face = formData.get("face");
    const dimensions = formData.get("dimensions");
    const type = formData.get("type");
    const material = formData.get("material");
    const name = formData.get("name");
    const sub_category = formData.get("sub_category");
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

    // check if item already exists
    const existingItem = await prisma.item.findUnique({
      where: { item_id: id },
      include: { image: true },
    });
    if (!existingItem) {
      return NextResponse.json(
        { status: false, message: "Item does not exist" },
        { status: 404 }
      );
    }

    // Prepare update data - only include fields that are provided
    const updateData = {};
    if (description !== null && description !== undefined)
      updateData.description = description;
    if (price !== null && price !== undefined)
      updateData.price = parseFloat(price);
    if (quantity !== null && quantity !== undefined)
      updateData.quantity = parseInt(quantity);
    if (supplier_id !== null && supplier_id !== undefined)
      updateData.supplier_id = supplier_id;
    if (measurement_unit !== null && measurement_unit !== undefined)
      updateData.measurement_unit = measurement_unit;
    if (supplier_reference !== null && supplier_reference !== undefined)
      updateData.supplier_reference = supplier_reference;
    if (supplier_product_link !== null && supplier_product_link !== undefined)
      updateData.supplier_product_link = supplier_product_link;

    // Update item first (without image_id)
    await prisma.item.update({
      where: { item_id: id },
      data: updateData,
    });

    // Handle image removal if imageFile is empty string
    if (imageFile === "") {
      try {
        if (existingItem.image_id && existingItem.image) {
          // Store the image URL and ID before removing the reference
          const imageUrl = existingItem.image.url;
          const imageId = existingItem.image_id;

          // First, update item to remove image_id (remove foreign key reference)
          await prisma.item.update({
            where: { item_id: id },
            data: { image_id: null },
          });

          // Now safe to delete the media record (no foreign key constraint)
          await prisma.media.delete({
            where: { id: imageId },
          });

          // Finally, delete the file from disk
          await deleteFileByRelativePath(imageUrl);
        }
      } catch (error) {
        console.error("Error handling image removal:", error);
        // Continue even if removal fails
      }
    }
    // Handle file upload if image is provided
    else if (imageFile && imageFile instanceof File) {
      try {
        // Store old image info before processing new image
        const oldImageUrl = existingItem.image_id && existingItem.image
          ? existingItem.image.url
          : null;
        const oldImageId = existingItem.image_id || null;

        // Upload new image FIRST (before deleting old one)
        const uploadResult = await uploadFile(imageFile, {
          uploadDir: "mediauploads",
          subDir: `items/${existingItem.category.toLowerCase()}`,
          filenameStrategy: "id-based",
          idPrefix: id,
        });

        // Create new media record
        const media = await prisma.media.create({
          data: {
            url: uploadResult.relativePath,
            filename: uploadResult.originalFilename,
            file_type: uploadResult.fileType,
            mime_type: uploadResult.mimeType,
            extension: uploadResult.extension,
            size: uploadResult.size,
            item_id: id,
          },
        });

        // Update item with new image_id (now we have the new image linked)
        await prisma.item.update({
          where: { item_id: id },
          data: { image_id: media.id },
        });

        // NOW delete old image file and media record (only after new image is successfully linked)
        if (oldImageId && oldImageUrl) {
          try {
            // Delete the old media record (safe now since item points to new image)
            await prisma.media.delete({
              where: { id: oldImageId },
            });

            // Delete the old file from disk
            await deleteFileByRelativePath(oldImageUrl);
          } catch (deleteError) {
            // Log but don't fail the entire operation if old image deletion fails
            console.error("Error deleting old image (non-critical):", deleteError);
          }
        }
      } catch (error) {
        console.error("Error handling image upload:", error);
        console.error("Upload error details:", {
          message: error.message,
          stack: error.stack,
          imageFile: imageFile ? {
            name: imageFile.name,
            size: imageFile.size,
            type: imageFile.type,
          } : null,
        });
        // Return error instead of silently failing
        return NextResponse.json(
          {
            status: false,
            message: "Failed to upload image",
            error: error.message,
          },
          { status: 500 }
        );
      }
    }

    // Update category-specific data
    if (existingItem.category.toLowerCase() === "sheet") {
      const sheetData = {};
      if (brand !== null && brand !== undefined) sheetData.brand = brand;
      if (color !== null && color !== undefined) sheetData.color = color;
      if (finish !== null && finish !== undefined) sheetData.finish = finish;
      if (face !== null && face !== undefined) sheetData.face = face;
      if (dimensions !== null && dimensions !== undefined)
        sheetData.dimensions = dimensions;
      // Update is_sunmica if provided
      if (is_sunmicaValue !== null && is_sunmicaValue !== undefined) {
        sheetData.is_sunmica = is_sunmica;
      }

      if (Object.keys(sheetData).length > 0) {
        await prisma.sheet.update({
          where: { item_id: id },
          data: sheetData,
        });
      }
    } else if (existingItem.category.toLowerCase() === "handle") {
      const handleData = {};
      if (brand !== null && brand !== undefined) handleData.brand = brand;
      if (color !== null && color !== undefined) handleData.color = color;
      if (type !== null && type !== undefined) handleData.type = type;
      if (dimensions !== null && dimensions !== undefined)
        handleData.dimensions = dimensions;
      if (material !== null && material !== undefined)
        handleData.material = material;

      if (Object.keys(handleData).length > 0) {
        await prisma.handle.update({
          where: { item_id: id },
          data: handleData,
        });
      }
    } else if (existingItem.category.toLowerCase() === "hardware") {
      const hardwareData = {};
      if (brand !== null && brand !== undefined) hardwareData.brand = brand;
      if (name !== null && name !== undefined) hardwareData.name = name;
      if (type !== null && type !== undefined) hardwareData.type = type;
      if (dimensions !== null && dimensions !== undefined)
        hardwareData.dimensions = dimensions;
      if (sub_category !== null && sub_category !== undefined)
        hardwareData.sub_category = sub_category;
      if (Object.keys(hardwareData).length > 0) {
        await prisma.hardware.update({
          where: { item_id: id },
          data: hardwareData,
        });
      }
    } else if (existingItem.category.toLowerCase() === "accessory") {
      const accessoryData = {};
      if (name !== null && name !== undefined) accessoryData.name = name;

      if (Object.keys(accessoryData).length > 0) {
        await prisma.accessory.update({
          where: { item_id: id },
          data: accessoryData,
        });
      }
    } else if (existingItem.category.toLowerCase() === "edging_tape") {
      const edging_tapeData = {};
      if (brand !== null && brand !== undefined) edging_tapeData.brand = brand;
      if (color !== null && color !== undefined) edging_tapeData.color = color;
      if (finish !== null && finish !== undefined)
        edging_tapeData.finish = finish;
      if (dimensions !== null && dimensions !== undefined)
        edging_tapeData.dimensions = dimensions;
      if (Object.keys(edging_tapeData).length > 0) {
        await prisma.edging_tape.update({
          where: { item_id: id },
          data: edging_tapeData,
        });
      }
    }
    // Fetch the complete updated item with all relations
    const completeItem = await prisma.item.findUnique({
      where: { item_id: id },
      include: {
        image: true,
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        supplier: true,
        edging_tape: true,
        materials_to_order_items: true,
        purchase_order_item: true,
      },
    });

    // Fetch stock transactions separately for all types (ADDED, USED, WASTED)
    const stock_transactions = await prisma.stock_transaction.findMany({
      where: { item_id: id },
      include: {
        purchase_order: {
          select: {
            order_no: true,
          },
        },
        materials_to_order: {
          include: {
            project: {
              select: {
                name: true,
              },
            },
            lots: {
              select: {
                lot_id: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Attach stock_transactions to item
    const itemWithTransactions = {
      ...completeItem,
      stock_transactions,
    };

    const logged = await withLogging(
      request,
      "item",
      id,
      "UPDATE",
      `Item updated successfully: ${completeItem.name}`
    );
    if (!logged) {
      console.error(`Failed to log item update: ${id} - ${completeItem.name}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Item updated successfully",
        data: itemWithTransactions,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in PATCH /api/item/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;

    const item = await prisma.item.findUnique({
      where: { item_id: id },
      include: { image: true },
    });

    if (!item) {
      return NextResponse.json(
        { status: false, message: "Item not found" },
        { status: 404 }
      );
    }

    if (item.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Item already deleted" },
        { status: 400 }
      );
    }

    // Handle image file soft deletion if exists
    if (item.image_id && item.image) {
      try {
        // Soft delete the media record instead of hard deleting
        await prisma.media.update({
          where: { id: item.image_id },
          data: { is_deleted: true },
        });
      } catch (error) {
        console.error("Error handling image soft deletion:", error);
        // Continue with item soft deletion even if image soft deletion fails
      }
    }

    // Soft delete the item record (set is_deleted flag)
    const deletedItem = await prisma.item.update({
      where: { item_id: id },
      data: { is_deleted: true },
    });

    const logged = await withLogging(request, "item", id, "DELETE", `Item deleted successfully: ${item.description || item.item_id}`);
    if (!logged) {
      console.error(`Failed to log item deletion: ${id} - ${item.description || item.item_id}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Item deleted successfully",
        data: deletedItem,
        ...(logged ? {} : { warning: "Note: Deletion succeeded but logging failed" })
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error in DELETE /api/item/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
