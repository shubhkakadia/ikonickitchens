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
    // Handle is_sunmica - FormData sends booleans as strings
    const is_sunmicaValue = formData.get("is_sunmica");
    const is_sunmica = is_sunmicaValue === "true" || is_sunmicaValue === true || is_sunmicaValue === "1";

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
        image: null,
        price: price ? parseFloat(price) : null,
        quantity: quantity ? parseInt(quantity) : null,
        category: category.toUpperCase(),
        supplier_id: supplier_id || null,
        measurement_unit: measurement_unit || null,
      },
    });

    let imagePath = null;

    // Handle file upload if image is provided
    if (imageFile) {
      const uploadResult = await uploadFile(imageFile, {
        uploadDir: "uploads",
        subDir: `items/${category}`,
        filenameStrategy: "id-based",
        idPrefix: createdItem.item_id,
      });
      imagePath = uploadResult.relativePath;

      // Update item with image path
      await prisma.item.update({
        where: { item_id: createdItem.item_id },
        data: { image: imagePath },
      });
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

    // include sheet, handle, hardware, accessory in item
    const item = {
      ...createdItem,
      image: imagePath || createdItem.image,
      sheet,
      handle,
      hardware,
      accessory,
      edging_tape,
    };

    return NextResponse.json(
      {
        status: true,
        message: "Item created successfully",
        data: item,
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
