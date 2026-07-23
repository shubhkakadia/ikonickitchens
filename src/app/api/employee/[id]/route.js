import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import { prisma } from "@/lib/db";
import {
  uploadFile,
  deleteFileByRelativePath,
  getFileFromFormData,
} from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";
import { formatPhoneToNational } from "@/components/validators";

const formatPhone = (phone) => (phone ? formatPhoneToNational(phone) : phone);

const NON_EMPTY_IF_PRESENT = ["first_name", "role", "email", "phone"];

// Builds an update object that only includes fields the caller actually sent.
// Prevents undefined-in-body -> null-in-DB from silently wiping columns
// (e.g. dob/join_date) on partial updates.
function buildPartialUpdate(body, fieldMap) {
  const result = {};
  for (const [key, transform] of Object.entries(fieldMap)) {
    if (body[key] !== undefined) {
      result[key] = transform ? transform(body[key]) : body[key];
    }
  }
  return result;
}

async function detachAndDeleteMedia(tx, { employeeId, mediaId, mediaUrl }) {
  await tx.employees.update({
    where: { id: employeeId },
    data: { image_id: null },
  });
  await tx.media.delete({ where: { id: mediaId } });
  // File deletion happens outside the transaction since it's not a DB op,
  // and there's nothing meaningful to roll back if this specific step fails.
  await deleteFileByRelativePath(mediaUrl);
}

export async function PATCH(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

    // Handle both FormData and JSON requests
    let body;
    let imageFile = null;
    let removeImage = false;
    const contentType = request.headers.get("content-type");

    if (contentType && contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const formData = await request.formData();
      imageFile = getFileFromFormData(formData, "image");
      const removeImageValue = formData.get("remove_image");
      removeImage = removeImageValue === "true" || removeImageValue === true;
      body = Object.fromEntries(formData.entries());
    }

    const { id } = await params;

    // Validate required fields are non-empty IF the caller is touching them
    const emptyFields = NON_EMPTY_IF_PRESENT.filter(
      (field) => body[field] !== undefined && String(body[field]).trim() === "",
    );
    if (emptyFields.length > 0) {
      return NextResponse.json(
        {
          status: false,
          message: `These fields cannot be empty: ${emptyFields.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Parse availability JSON string to object for validation, then stringify for Prisma
    let availabilityString;
    if (body.availability !== undefined) {
      if (body.availability === null) {
        availabilityString = null;
      } else if (
        typeof body.availability === "string" &&
        body.availability.trim() !== ""
      ) {
        try {
          JSON.parse(body.availability);
          availabilityString = body.availability;
        } catch (error) {
          console.error("Error parsing availability JSON:", error);
          return NextResponse.json(
            { status: false, message: "Invalid availability data format" },
            { status: 400 },
          );
        }
      } else if (typeof body.availability === "object") {
        availabilityString = JSON.stringify(body.availability);
      } else {
        availabilityString = null;
      }
    }

    // Get current employee to check for existing image / confirm it exists
    const currentEmployee = await prisma.employees.findUnique({
      where: { employee_id: id },
      include: { image: true },
    });

    if (!currentEmployee) {
      return NextResponse.json(
        { status: false, message: "Employee not found" },
        { status: 404 },
      );
    }

    // Build update data object - ONLY include fields actually present in the request.
    // This is the critical fix: previously every field was included unconditionally,
    // so an omitted `dob`/`join_date` became `undefined` -> processDateTimeField ->
    // `null`, silently wiping out existing values on any partial update.
    const updateData = buildPartialUpdate(body, {
      first_name: null,
      last_name: null,
      role: null,
      email: null,
      phone: formatPhone,
      phone_secondary: formatPhone,
      dob: processDateTimeField,
      join_date: processDateTimeField,
      address: null,
      emergency_contact_name: null,
      emergency_contact_phone: formatPhone,
      bank_account_name: null,
      bank_account_number: null,
      bank_account_bsb: null,
      supper_account_name: null,
      supper_account_number: null,
      tfn_number: null,
      abn_number: null,
      education: null,
      notes: null,
    });

    if (availabilityString !== undefined) {
      updateData.availability = availabilityString;
    }

    // Only include is_active if it's provided
    if (body.is_active !== undefined && body.is_active !== null) {
      updateData.is_active =
        body.is_active === "true" || body.is_active === true;
    }

    // Update employee first (without touching image_id)
    const employee = await prisma.employees.update({
      where: { employee_id: id },
      data: updateData,
    });

    let imageWarning = null;

    // Handle image removal if requested
    if (
      removeImage &&
      !imageFile &&
      currentEmployee.image_id &&
      currentEmployee.image
    ) {
      try {
        await prisma.$transaction((tx) =>
          detachAndDeleteMedia(tx, {
            employeeId: employee.id,
            mediaId: currentEmployee.image_id,
            mediaUrl: currentEmployee.image.url,
          }),
        );
      } catch (error) {
        console.error("Error handling image removal:", error);
        imageWarning = "Employee updated, but existing image could not be removed";
      }
    }
    // Handle image upload if a new image is provided
    else if (imageFile && imageFile instanceof File) {
      try {
        // Delete old image file and media record if one exists
        if (currentEmployee.image_id && currentEmployee.image) {
          await prisma.$transaction((tx) =>
            detachAndDeleteMedia(tx, {
              employeeId: employee.id,
              mediaId: currentEmployee.image_id,
              mediaUrl: currentEmployee.image.url,
            }),
          );
        }

        // Upload new image
        const uploadResult = await uploadFile(imageFile, {
          uploadDir: "mediauploads",
          subDir: "employees",
          filenameStrategy: "id-based",
          idPrefix: id,
        });

        // Create media record + link it to the employee atomically
        await prisma.$transaction(async (tx) => {
          const media = await tx.media.create({
            data: {
              url: uploadResult.relativePath,
              filename: uploadResult.originalFilename,
              file_type: "employee_photo",
              mime_type: uploadResult.mimeType,
              extension: uploadResult.extension,
              size: uploadResult.size,
              employee_id: employee.id,
            },
          });

          await tx.employees.update({
            where: { id: employee.id },
            data: { image_id: media.id },
          });
        });
      } catch (error) {
        console.error("Error handling image upload:", error);
        imageWarning = "Employee updated, but image upload failed";
      }
    }

    // Fetch the updated employee with image relation (select, not include,
    // to avoid pulling the linked user's password hash into the response)
    const updatedEmployee = await prisma.employees.findUnique({
      where: { id: employee.id },
      include: { image: true },
    });

    const logged = await withLogging(
      request,
      "employee",
      id,
      "UPDATE",
      `Employee updated successfully: ${employee.first_name} ${employee.last_name}`,
    );
    if (!logged) {
      console.error(
        `Failed to log employee update: ${id} - ${employee.first_name} ${employee.last_name}`,
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Employee updated successfully",
        data: updatedEmployee,
        ...(logged ? {} : { warning: "Note: Update succeeded but logging failed" }),
        ...(imageWarning ? { imageWarning } : {}),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/employee/[id]:", error);

    if (error.code === "P2025") {
      return NextResponse.json(
        { status: false, message: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}