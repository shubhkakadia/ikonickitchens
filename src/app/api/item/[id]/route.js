import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import {
  uploadFile,
  deleteFileByRelativePath,
  getFileFromFormData,
} from "@/lib/fileHandler";

export async function GET(request, { params }) {
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
    const { id } = await params;
    const item = await prisma.item.findUnique({
      where: { item_id: id },
      include: {
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        edging_tape: true,
        supplier: true,
        materials_to_order_items: true,
        purchase_order_item: true,
        stock_transactions: true,
      },
    });
    return NextResponse.json(
      { status: true, message: "Item fetched successfully", data: item },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(request, { params }) {
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
    // Handle is_sunmica - FormData sends booleans as strings
    const is_sunmicaValue = formData.get("is_sunmica");
    const is_sunmica = is_sunmicaValue === "true" || is_sunmicaValue === true || is_sunmicaValue === "1";

    // check if item already exists
    const existingItem = await prisma.item.findUnique({
      where: { item_id: id },
    });
    if (!existingItem) {
      return NextResponse.json(
        { status: false, message: "Item does not exist" },
        { status: 404 }
      );
    }
    let imagePath = null;

    // Handle file upload if image is provided
    if (imageFile) {
      const uploadResult = await uploadFile(imageFile, {
        uploadDir: "uploads",
        subDir: `items/${existingItem.category}`,
        filenameStrategy: "id-based",
        idPrefix: id,
      });
      imagePath = uploadResult.relativePath;
    }
    if (imageFile === "") {
      imagePath = "";
    }

    // Prepare update data - only include fields that are provided
    const updateData = {};
    if (description !== null && description !== undefined)
      updateData.description = description;
    if (price !== null && price !== undefined)
      updateData.price = parseFloat(price);
    if (quantity !== null && quantity !== undefined)
      updateData.quantity = parseInt(quantity);
    // Only update image if a new one was uploaded
    if (imagePath !== null) updateData.image = imagePath;
    if (supplier_id !== null && supplier_id !== undefined)
      updateData.supplier_id = supplier_id;
    if (measurement_unit !== null && measurement_unit !== undefined)
      updateData.measurement_unit = measurement_unit;
    await prisma.item.update({
      where: { item_id: id },
      data: updateData,
    });

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
    }
    else if (existingItem.category.toLowerCase() === "edging_tape") {
      const edging_tapeData = {};
      if (brand !== null && brand !== undefined) edging_tapeData.brand = brand;
      if (color !== null && color !== undefined) edging_tapeData.color = color;
      if (finish !== null && finish !== undefined) edging_tapeData.finish = finish;
      if (dimensions !== null && dimensions !== undefined) edging_tapeData.dimensions = dimensions;
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
        sheet: true,
        handle: true,
        hardware: true,
        accessory: true,
        supplier: true,
        edging_tape: true,
        materials_to_order_items: true,
        purchase_order_item: true,
        stock_transactions: true,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Item updated successfully",
        data: completeItem,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
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
    const { id } = await params;
    const item = await prisma.item.findUnique({
      where: { item_id: id },
    });
    if (!item) {
      return NextResponse.json(
        { status: false, message: "Item not found" },
        { status: 404 }
      );
    }
    await prisma.item.delete({
      where: { item_id: id },
    });
    // delete file from storage
    return NextResponse.json(
      { status: true, message: "Item deleted successfully", data: item },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { status: false, message: "Internal server error", error: error.message },
      { status: 500 }
    );
  }
}
