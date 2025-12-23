import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import {
  validateAdminAuth,
  processDateTimeField,
} from "@/lib/validators/authFromToken";
import {
  uploadFile,
  validateMultipartRequest,
  getFileFromFormData,
} from "@/lib/fileHandler";
import { withLogging } from "@/lib/withLogging";
import { formatPhoneToNational } from "@/components/validators";

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;
    // Validate and parse multipart/form-data
    const formData = await validateMultipartRequest(request);
    const body = Object.fromEntries(formData.entries());

    const imageFile = getFileFromFormData(formData, "image");
    const {
      employee_id,
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

    // Check if employee_id already exists
    const existingEmployee = await prisma.employees.findUnique({
      where: { employee_id },
    });

    if (existingEmployee) {
      return NextResponse.json(
        {
          status: false,
          message:
            "Employee already exists by this employee id: " + employee_id,
        },
        { status: 409 }
      );
    }

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
            { status: 400 }
          );
        }
      } else if (typeof availability === "object" && availability !== null) {
        // Convert object to JSON string for Prisma
        availabilityString = JSON.stringify(availability);
      }
    }

    // Parse is_active - handle string "true"/"false" or boolean
    const isActiveValue = is_active === "true" || is_active === true || is_active === undefined || is_active === null ? true : false;

    // Format phone numbers to national format before saving
    const formattedPhone = phone ? formatPhoneToNational(phone) : phone;
    const formattedEmergencyPhone = emergency_contact_phone
      ? formatPhoneToNational(emergency_contact_phone)
      : emergency_contact_phone;

    const formatPhone = (phone) => {
      return phone ? formatPhoneToNational(phone) : phone;
    }

    // Create employee first (without image_id)
    const employee = await prisma.employees.create({
      data: {
        employee_id,
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
        is_active: isActiveValue,
      },
    });

    // Handle image upload if image is provided
    let imageId = null;
    if (imageFile) {
      try {
        // Upload file with ID-based naming
        const uploadResult = await uploadFile(imageFile, {
          uploadDir: "mediauploads",
          subDir: "employees",
          filenameStrategy: "id-based",
          idPrefix: employee_id,
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

        imageId = media.id;

        // Update employee with image_id
        await prisma.employees.update({
          where: { id: employee.id },
          data: { image_id: imageId },
        });
      } catch (error) {
        console.error("Error handling image upload:", error);
        // Continue without image if upload fails
        // Employee is already created, so we don't fail the whole request
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
      employee.id,
      "CREATE",
      `Employee created successfully: ${employee.first_name} ${employee.last_name}`
    );
    if (!logged) {
      console.error(`Failed to log employee creation: ${employee.id} - ${employee.first_name} ${employee.last_name}`);
    }

    return NextResponse.json(
      {
        status: true,
        message: "Employee created successfully",
        ...(logged ? {} : { warning: "Note: Creation succeeded but logging failed" }),
        data: updatedEmployee,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error in POST /api/employee/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 }
    );
  }
}
