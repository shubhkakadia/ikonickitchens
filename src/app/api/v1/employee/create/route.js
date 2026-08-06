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

const REQUIRED_FIELDS = ["employee_id", "first_name", "role", "email", "phone"];

const formatPhone = (phone) => (phone ? formatPhoneToNational(phone) : phone);

export async function POST(request) {
  try {
    const authError = await validateAdminAuth(request);
    if (authError) return authError;

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
      phone_secondary,
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

    const missingFields = REQUIRED_FIELDS.filter(
      (field) => !body[field] || String(body[field]).trim() === "",
    );
    if (missingFields.length > 0) {
      return NextResponse.json(
        {
          status: false,
          message: `Missing required fields: ${missingFields.join(", ")}`,
        },
        { status: 400 },
      );
    }

    let availabilityString = null;
    if (availability !== null && availability !== undefined) {
      if (typeof availability === "string" && availability.trim() !== "") {
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
      } else if (typeof availability === "object") {
        availabilityString = JSON.stringify(availability);
      }
    }

    const isActiveValue =
      is_active === undefined || is_active === null
        ? true
        : is_active === "true" || is_active === true;

    let employee;
    try {
      employee = await prisma.employees.create({
        data: {
          employee_id,
          first_name,
          last_name,
          role,
          email,
          phone: formatPhone(phone),
          phone_secondary: formatPhone(phone_secondary),
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
    } catch (error) {
      if (error.code === "P2002") {
        return NextResponse.json(
          {
            status: false,
            message: `Employee already exists with this employee id: ${employee_id}`,
          },
          { status: 409 },
        );
      }
      throw error;
    }

    let imageUploadWarning = null;
    if (imageFile) {
      try {
        const uploadResult = await uploadFile(imageFile, {
          uploadDir: "mediauploads",
          subDir: "employees",
          filenameStrategy: "id-based",
          idPrefix: employee_id,
        });

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
        imageUploadWarning = "Employee created, but image upload failed";
      }
    }

    const updatedEmployee = await prisma.employees.findUnique({
      where: { id: employee.id },
      include: { image: true },
    });

    const logged = await withLogging(
      request,
      "employee",
      employee.id,
      "CREATE",
      `Employee created successfully: ${employee.first_name} ${employee.last_name}`,
    );
    if (!logged) {
      console.error(
        `Failed to log employee creation: ${employee.id} - ${employee.first_name} ${employee.last_name}`,
      );
    }

    return NextResponse.json(
      {
        status: true,
        message: "Employee created successfully",
        ...(logged
          ? {}
          : { warning: "Note: Creation succeeded but logging failed" }),
        ...(imageUploadWarning ? { imageWarning: imageUploadWarning } : {}),
        data: updatedEmployee,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/employee/create:", error);
    return NextResponse.json(
      { status: false, message: "Internal Server Error" },
      { status: 500 },
    );
  }
}
