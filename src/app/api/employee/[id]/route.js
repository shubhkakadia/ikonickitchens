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

export async function GET(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;
    const employee = await prisma.employees.findFirst({
      where: {
        employee_id: id,
        is_deleted: false,
      },
      include: {
        image: true,
        user: {
          include: {
            module_access: true,
          },
        },
      },
    });

    if (!employee) {
      return NextResponse.json(
        { status: false, message: "Employee not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Employee fetched successfully",
        data: employee,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in GET /api/employee/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
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

    const {
      first_name,
      last_name,
      role,
      email,
      phone,
      dob,
      join_date,
      address,
      emergency_contact_name,
      emergency_contact_phone,
      bank_account_name,
      bank_account_number,
      bank_account_bsb,
      supper_account_name,
      supper_account_number,
      tfn_number,
      abn_number,
      education,
      availability,
      notes,
      is_active,
    } = body;

    // Parse availability JSON string to object for validation, then stringify for Prisma
    let availabilityString = null;
    if (availability !== null && availability !== undefined) {
      if (typeof availability === "string" && availability.trim() !== "") {
        // Validate it's valid JSON, but keep as string for Prisma
        try {
          JSON.parse(availability);
          availabilityString = availability;
        } catch (error) {
          console.error("Error parsing availability JSON:", error);
          return NextResponse.json(
            { status: false, message: "Invalid availability data format" },
            { status: 400 },
          );
        }
      } else if (typeof availability === "object" && availability !== null) {
        // Convert object to JSON string for Prisma
        availabilityString = JSON.stringify(availability);
      }
    }

    const { id } = await params;

    // Get current employee to check for existing image
    const currentEmployee = await prisma.employees.findUnique({
      where: { employee_id: id },
      include: { image: true },
    });

    const formatPhone = (phone) => {
      return phone ? formatPhoneToNational(phone) : phone;
    };

    // Build update data object - only include fields that are provided
    const updateData = {
      first_name,
      last_name,
      role,
      email,
      phone: formatPhone(phone),
      dob: processDateTimeField(dob),
      join_date: processDateTimeField(join_date),
      address,
      emergency_contact_name,
      emergency_contact_phone: formatPhone(emergency_contact_phone),
      bank_account_name,
      bank_account_number,
      bank_account_bsb,
      supper_account_name,
      supper_account_number,
      tfn_number,
      abn_number,
      education,
      availability: availabilityString,
      notes,
    };

    // Only include is_active if it's provided
    if (is_active !== undefined && is_active !== null) {
      // Parse is_active - handle string "true"/"false" or boolean
      updateData.is_active = is_active === "true" || is_active === true;
    }

    // Update employee first (without image_id)
    const employee = await prisma.employees.update({
      where: { employee_id: id },
      data: updateData,
    });

    // Handle image removal if requested
    if (
      removeImage &&
      !imageFile &&
      currentEmployee.image_id &&
      currentEmployee.image
    ) {
      try {
        // Store the image URL and ID before removing the reference
        const imageUrl = currentEmployee.image.url;
        const imageId = currentEmployee.image_id;

        // First, update employee to remove image_id (remove foreign key reference)
        await prisma.employees.update({
          where: { id: employee.id },
          data: { image_id: null },
        });

        // Now safe to delete the media record (no foreign key constraint)
        await prisma.media.delete({
          where: { id: imageId },
        });

        // Finally, delete the file from disk
        await deleteFileByRelativePath(imageUrl);
      } catch (error) {
        console.error("Error handling image removal:", error);
        // Continue even if removal fails
      }
    }
    // Handle image upload if image is provided
    else if (imageFile && imageFile instanceof File) {
      try {
        // Delete old image file and media record if exists
        if (currentEmployee.image_id && currentEmployee.image) {
          // Store the image URL and ID before removing the reference
          const oldImageUrl = currentEmployee.image.url;
          const oldImageId = currentEmployee.image_id;

          // First, update employee to remove image_id (remove foreign key reference)
          await prisma.employees.update({
            where: { id: employee.id },
            data: { image_id: null },
          });

          // Now safe to delete the media record (no foreign key constraint)
          await prisma.media.delete({
            where: { id: oldImageId },
          });

          // Finally, delete the file from disk
          await deleteFileByRelativePath(oldImageUrl);
        }

        // Upload new image
        const uploadResult = await uploadFile(imageFile, {
          uploadDir: "mediauploads",
          subDir: "employees",
          filenameStrategy: "id-based",
          idPrefix: id,
        });

        // Create media record
        const media = await prisma.media.create({
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

        // Update employee with image_id
        await prisma.employees.update({
          where: { id: employee.id },
          data: { image_id: media.id },
        });
      } catch (error) {
        console.error("Error handling image upload:", error);
        // Continue without image if upload fails
        // Employee is already updated, so we don't fail the whole request
      }
    }

    // Fetch the updated employee with image relation
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
        ...(logged
          ? {}
          : { warning: "Note: Update succeeded but logging failed" }),
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in PATCH /api/employee/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    const { id } = await params;

    // Fetch employee with image relation before soft deleting
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

    // Check if already deleted
    if (currentEmployee.is_deleted) {
      return NextResponse.json(
        { status: false, message: "Employee already deleted" },
        { status: 400 },
      );
    }

    // Handle image file soft deletion if exists
    if (currentEmployee.image_id && currentEmployee.image) {
      try {
        // Soft delete the media record instead of hard deleting
        await prisma.media.update({
          where: { id: currentEmployee.image_id },
          data: { is_deleted: true },
        });
      } catch (error) {
        console.error("Error handling image soft deletion:", error);
        // Continue with employee soft deletion even if image soft deletion fails
      }
    }

    // Soft delete the employee record (set is_deleted flag)
    const employee = await prisma.employees.update({
      where: { employee_id: id },
      data: { is_deleted: true },
    });

    const logged = await withLogging(
      request,
      "employee",
      id,
      "DELETE",
      `Employee deleted successfully: ${employee.first_name} ${employee.last_name}`,
    );
    if (!logged) {
      console.error(
        `Failed to log employee deletion: ${id} - ${employee.first_name} ${employee.last_name}`,
      );
      return NextResponse.json(
        {
          status: true,
          message: "Employee deleted successfully",
          data: employee,
          warning: "Note: Deletion succeeded but logging failed",
        },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        status: true,
        message: "Employee deleted successfully",
        data: employee,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error in DELETE /api/employee/[id]:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
