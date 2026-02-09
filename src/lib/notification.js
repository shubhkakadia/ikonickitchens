import { prisma } from "@/lib/db";
import axios from "axios";
import { parsePhoneNumber } from "libphonenumber-js";

// WhatsApp Business API Configuration
const WHATSAPP_API_URL =
  process.env.NEXT_PUBLIC_WHATSAPP_API_URL ||
  "https://graph.facebook.com/v24.0/980380258481972/messages";
const WHATSAPP_ACCESS_TOKEN = process.env.NEXT_PUBLIC_WHATSAPP_ACCESS_TOKEN;

/**
 * Sends a WhatsApp message using Meta Graph API with template components
 * @param {string} phoneNumber - Recipient phone number (with country code, e.g., "61478518103")
 * @param {string} templateName - WhatsApp template name
 * @param {Array<Object>} parameters - Array of parameter objects with type and text
 * @returns {Promise<Object>} - Response from WhatsApp API
 */
async function sendWhatsAppMessage(phoneNumber, templateName, parameters = []) {
  if (!WHATSAPP_ACCESS_TOKEN) {
    throw new Error("WHATSAPP_ACCESS_TOKEN environment variable is not set");
  }

  try {
    const requestBody = {
      messaging_product: "whatsapp",
      to: formatPhone(phoneNumber),
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "en",
        },
      },
    };

    // Add components with parameters if provided
    if (parameters.length > 0) {
      requestBody.template.components = [
        {
          type: "body",
          parameters: parameters.map((param) => ({
            type: "text",
            text:
              param === undefined ||
              param === null ||
              String(param).trim() === ""
                ? "-"
                : String(param),
          })),
        },
      ];
    }

    const response = await axios.post(WHATSAPP_API_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error sending WhatsApp message:", error);
    // Handle axios errors
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      throw new Error(
        `WhatsApp API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`,
      );
    } else if (error.request) {
      // The request was made but no response was received
      throw new Error(
        `WhatsApp API error: No response received - ${error.message}`,
      );
    } else {
      // Something happened in setting up the request that triggered an Error
      throw new Error(`WhatsApp API error: ${error.message}`);
    }
  }
}

/**
 * Builds template parameters for stage_completed notification
 * @param {Object} data - Stage completion data
 * @returns {Array<string>} - Array of parameter values
 */
function buildStageCompletedParams(data) {
  const {
    project_name = "Unknown Project",
    client_name = "Unknown Client",
    lot_id = "Unknown Lot",
    stage_name = "Unknown Stage",
    status = "Unknown Status",
  } = data;

  return [project_name, client_name, lot_id, stage_name, status];
}

/**
 * Builds template parameters for materials_to_order_list_update notification
 * @param {Object} data - MTO update data
 * @returns {Array<string>} - Array of parameter values
 */
function buildMtoUpdateParams(data) {
  const {
    status = "updated", // "generated", "updated", or "{supplier_name} Ordered"
    project_name = "Unknown Project",
    lot_name = "Unknown Lot",
    client_name = "Unknown Client",
  } = data;

  return [status, project_name, lot_name, client_name];
}

/**
 * Builds template parameters for supplier_statement_added notification
 * @param {Object} data - Supplier statement data
 * @returns {Array<string>} - Array of parameter values
 */
function buildSupplierStatementParams(data) {
  const {
    supplier_name = "Unknown Supplier",
    year_month = "Unknown Period",
    amount = "0",
    due_date = "Unknown Date",
  } = data;

  // Format amount if it's a number
  const formattedAmount =
    typeof amount === "number" ? `$${amount.toFixed(2)}` : amount;

  // Format due date if it's a Date object or ISO string
  let formattedDueDate = due_date;
  if (due_date && due_date !== "Unknown Date") {
    try {
      const date = new Date(due_date);
      if (!isNaN(date.getTime())) {
        formattedDueDate = date.toLocaleDateString("en-AU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
      }
    } catch (e) {
      // Keep original value if parsing fails
    }
  }

  return [supplier_name, year_month, formattedAmount, formattedDueDate];
}

/**
 * Builds template parameters for stock_transaction_created notification
 * @param {Object} data - Stock transaction data
 * @returns {Array<string>} - Array of parameter values
 */
function buildStockTransactionParams(data) {
  const {
    item_name = "Unknown Item", // Should include brand, color, finish
    status = "Unknown Status",
    quantity_added = "0",
    dimensions = "N/A",
  } = data;

  return [item_name, status, String(quantity_added), dimensions];
}

/**
 * Builds template parameters for assign_installer notification
 * @param {Object} data - Installer assignment data
 * @returns {Array<string>} - Array of parameter values
 */
function buildAssignInstallerParams(data) {
  const {
    installer_name = "Unknown Installer",
    project_name = "Unknown Project",
    lot_id = "Unknown Lot",
    url = "https://ikonickitchens.com.au/admin/site_photos",
  } = data;

  return [installer_name, project_name, lot_id, url];
}

/**
 * Builds template parameters for meeting_confirmation notification
 * @param {Object} data - Meeting confirmation data
 * @returns {Array<string>} - Array of parameter values
 */
function buildMeetingConfirmationParams(data) {
  const {
    title = "Meeting",
    project_names = "No projects",
    lot_id_client = "No lots",
    date = "",
    time = "",
    participant1 = "No participants",
    participant2_plus = "",
    notes = "No notes provided",
  } = data;

  return [
    title,
    project_names,
    lot_id_client,
    date,
    time,
    participant1,
    participant2_plus,
    notes,
  ];
}

// Format phone number to Australian national format for storage
function formatPhone(phone) {
  if (!phone || typeof phone !== "string" || phone.trim() === "") return phone; // Return as-is if empty
  try {
    const phoneNumber = parsePhoneNumber(phone.trim(), "AU");
    if (phoneNumber && phoneNumber.isValid()) {
      // Return in national format (e.g., "0400 123 456")
      let number = phoneNumber.number;
      return number.replace("+", "");
    }
    // If parsing fails, return original value
    return phone.trim();
  } catch (error) {
    // If parsing fails, return original value
    return phone.trim();
  }
}

/**
 * Determines which notification types should be triggered based on the record
 * @param {Object} record - The updated record object
 * @returns {Array<string>} - Array of notification type keys to check
 */
function determineNotificationTypes(record) {
  const notificationTypes = [];

  // Check record type and determine notification types
  if (record.type) {
    switch (record.type) {
      case "material_to_order":
        // Check if it's an ordered notification (has supplier_name in status)
        if (
          record.status &&
          typeof record.status === "string" &&
          record.status.includes("Ordered")
        ) {
          notificationTypes.push("material_to_order_ordered");
        } else {
          notificationTypes.push("material_to_order");
        }
        // Also add the WhatsApp template notification type
        notificationTypes.push("materials_to_order_list_update");
        break;
      case "stock_transaction":
        notificationTypes.push("stock_transactions");
        // Also add the WhatsApp template notification type
        notificationTypes.push("stock_transaction_created");
        break;
      case "supplier_statement":
        notificationTypes.push("supplier_statements");
        // Also add the WhatsApp template notification type
        notificationTypes.push("supplier_statement_added");
        break;
      case "assign_installer":
        notificationTypes.push("assign_installer");
        break;
      case "stage":
      case "stage_update":
        // Map stage name to notification config field
        if (record.stage_name) {
          const stageFieldMap = {
            quote_approve: "stage_quote_approve",
            material_appliances_selection:
              "stage_material_appliances_selection",
            drafting: "stage_drafting",
            drafting_revision: "stage_drafting_revision",
            final_design_approval: "stage_final_design_approval",
            site_measurements: "stage_site_measurements",
            final_approval_for_production:
              "stage_final_approval_for_production",
            machining_out: "stage_machining_out",
            material_order: "stage_material_order",
            cnc: "stage_cnc",
            assembly: "stage_assembly",
            delivery: "stage_delivery",
            installation: "stage_installation",
            invoice_sent: "stage_invoice_sent",
            maintenance: "stage_maintenance",
            job_completion: "stage_job_completion",
          };
          const stageField = stageFieldMap[record.stage_name.toLowerCase()];
          if (stageField) {
            notificationTypes.push(stageField);
          }
        }
        // If stage is completed, also add the WhatsApp template notification type
        if (record.status === "COMPLETED") {
          notificationTypes.push("stage_completed");
        }
        break;
    }
  }

  // Fallback: check for explicit notification_type in record
  if (record.notification_type) {
    if (Array.isArray(record.notification_type)) {
      notificationTypes.push(...record.notification_type);
    } else {
      notificationTypes.push(record.notification_type);
    }
  }

  return [...new Set(notificationTypes)]; // Remove duplicates
}

/**
 * Gets users who should receive notifications for the given template name
 * @param {string} templateName - The WhatsApp template name
 * @param {Object} record - The record data (needed for stage_completed to map stage_name)
 * @returns {Promise<Array>} - Array of users with their phone numbers and notification configs
 */
async function getUsersToNotify(templateName, record = {}) {
  if (!templateName) {
    return [];
  }

  try {
    // Get the notification config field name for this template
    const configField = getNotificationConfigField(templateName, record);

    if (!configField) {
      console.warn(
        `No notification config field found for template: ${templateName}`,
      );
      return [];
    }

    // Find all users who have this notification type enabled
    const notificationConfigs = await prisma.notification_config.findMany({
      where: {
        [configField]: true,
      },
      include: {
        user: {
          include: {
            employee: {
              select: {
                phone: true,
                phone_secondary: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
    });

    // Filter to only include users with phone numbers and active status
    // Also create separate entries for secondary phone numbers
    const users = [];

    notificationConfigs.forEach((config) => {
      const user = config.user;

      if (
        user &&
        user.is_active &&
        user.employee &&
        config[configField] === true
      ) {
        // Add primary phone if exists
        if (user.employee.phone) {
          users.push({
            userId: config.user_id,
            phone: formatPhone(user.employee.phone),
            firstName: user.employee.first_name,
            lastName: user.employee.last_name,
            notificationConfig: config,
          });
        }

        // Add secondary phone if exists and different from primary
        if (
          user.employee.phone_secondary &&
          formatPhone(user.employee.phone_secondary) !==
            formatPhone(user.employee.phone || "")
        ) {
          users.push({
            userId: config.user_id,
            phone: formatPhone(user.employee.phone_secondary),
            firstName: user.employee.first_name,
            lastName: user.employee.last_name,
            notificationConfig: config,
            isSecondaryPhone: true,
          });
        }
      }
    });

    return users;
  } catch (error) {
    console.error("Error fetching users to notify:", error);
    return [];
  }
}

/**
 * Maps notification types to WhatsApp template names
 */
const TEMPLATE_NAME_MAP = {
  stage_completed: "stage_completed",
  materials_to_order_list_update: "materials_to_order_list_update",
  supplier_statement_added: "supplier_statement_added",
  stock_transaction_created: "stock_transaction_created",
  assign_installer: "assign_installer",
  meeting_confirmation: "meeting_confirmation",
};

/**
 * Maps template names to notification config fields
 * @param {string} templateName - The WhatsApp template name
 * @param {Object} record - The record data (for stage_completed, needs stage_name)
 * @returns {string|null} - The notification config field name, or null if not found
 */
function getNotificationConfigField(templateName, record = {}) {
  switch (templateName) {
    case TEMPLATE_NAME_MAP.materials_to_order_list_update:
      // Check if this is an ordered notification (has supplier_name in status)
      if (
        record.status &&
        typeof record.status === "string" &&
        record.status.includes("Ordered")
      ) {
        return "material_to_order_ordered";
      }
      return "material_to_order";
    case TEMPLATE_NAME_MAP.assign_installer:
      return "assign_installer";
    case TEMPLATE_NAME_MAP.supplier_statement_added:
      return "supplier_statements";
    case TEMPLATE_NAME_MAP.stock_transaction_created:
      return "stock_transactions";
    case TEMPLATE_NAME_MAP.stage_completed:
      // For stage_completed, map stage_name to the specific stage config field
      if (record.stage_name) {
        const stageFieldMap = {
          "quote approval": "stage_quote_approve",
          material_appliances_selection: "stage_material_appliances_selection",
          drafting: "stage_drafting",
          "drafting revision": "stage_drafting_revision",
          "final design approval": "stage_final_design_approval",
          "site measurements": "stage_site_measurements",
          "final approval for production":
            "stage_final_approval_for_production",
          "machining out": "stage_machining_out",
          "material order": "stage_material_order",
          cnc: "stage_cnc",
          assembly: "stage_assembly",
          delivery: "stage_delivery",
          installation: "stage_installation",
          "invoice sent": "stage_invoice_sent",
          maintenance: "stage_maintenance",
          "job completion": "stage_job_completion",
        };
        const stageName = record.stage_name.toLowerCase();
        return stageFieldMap[stageName] || null;
      }
      return null;
    case TEMPLATE_NAME_MAP.meeting_confirmation:
      return "meeting";
    default:
      return null;
  }
}

/**
 * Determines the WhatsApp template name and builds parameters based on notification type
 * @param {Object} record - The record data (all data should be provided by the API endpoint)
 * @param {string} templateName - Optional explicit template name to use
 */
function prepareWhatsAppMessage(record, templateName = null) {
  let finalTemplateName = templateName;
  let parameters = [];

  // If template name is provided, use it; otherwise determine from record
  if (!finalTemplateName) {
    // Determine template and parameters based on notification type
    if (
      record.notification_type === "stage_completed" ||
      (record.type === "stage" && record.status === "DONE")
    ) {
      finalTemplateName = TEMPLATE_NAME_MAP.stage_completed;
      parameters = buildStageCompletedParams({
        project_name: record.project_name,
        client_name: record.client_name,
        lot_id: record.lot_id,
        stage_name: record.stage_name || record.name,
        status: record.status,
      });
    } else if (
      record.notification_type === "materials_to_order_list_update" ||
      record.type === "material_to_order"
    ) {
      finalTemplateName = TEMPLATE_NAME_MAP.materials_to_order_list_update;
      // Determine status: if supplier_name is provided and it's an ordered notification, use "{supplier_name} Ordered"
      // Otherwise, use "generated" for new or "updated" for existing
      let status;
      if (record.supplier_name && record.is_ordered) {
        status = `${record.supplier_name} Ordered`;
      } else {
        status = record.is_new ? "generated" : "updated";
      }
      parameters = buildMtoUpdateParams({
        status,
        project_name: record.project_name,
        lot_name: record.lot_name,
        client_name: record.client_name,
      });
    } else if (
      record.notification_type === "supplier_statement_added" ||
      record.type === "supplier_statement"
    ) {
      finalTemplateName = TEMPLATE_NAME_MAP.supplier_statement_added;
      parameters = buildSupplierStatementParams({
        supplier_name: record.supplier_name,
        year_month: record.year_month || record.month_year,
        amount: record.amount,
        due_date: record.due_date,
      });
    } else if (
      record.notification_type === "stock_transaction_created" ||
      record.type === "stock_transaction"
    ) {
      finalTemplateName = TEMPLATE_NAME_MAP.stock_transaction_created;
      // Use the transaction type (ADDED, USED, WASTED) as status
      const transactionType = ["ADDED", "USED", "WASTED"].includes(record.type)
        ? record.type
        : record.transaction_type || "ADDED";
      parameters = buildStockTransactionParams({
        item_name: record.item_name,
        status: transactionType,
        quantity_added: record.quantity,
        dimensions: record.dimensions,
      });
    } else if (
      record.notification_type === "assign_installer" ||
      record.type === "assign_installer"
    ) {
      finalTemplateName = TEMPLATE_NAME_MAP.assign_installer;
      parameters = buildAssignInstallerParams({
        installer_name: record.installer_name,
        project_name: record.project_name,
        lot_id: record.lot_id,
        url: "https://ikonickitchens.com.au/admin/site_photos",
      });
    }
  } else {
    // Template name provided - build parameters based on template name
    if (finalTemplateName === TEMPLATE_NAME_MAP.stage_completed) {
      parameters = buildStageCompletedParams({
        project_name: record.project_name,
        client_name: record.client_name,
        lot_id: record.lot_id,
        stage_name: record.stage_name || record.name,
        status: record.status,
      });
    } else if (
      finalTemplateName === TEMPLATE_NAME_MAP.materials_to_order_list_update
    ) {
      // Determine status: if supplier_name is provided and it's an ordered notification, use "{supplier_name} Ordered"
      // Otherwise, use "generated" for new or "updated" for existing
      let status;
      if (record.supplier_name && record.is_ordered) {
        status = `${record.supplier_name} Ordered`;
      } else {
        status = record.is_new ? "generated" : "updated";
      }
      parameters = buildMtoUpdateParams({
        status,
        project_name: record.project_name,
        lot_name: record.lot_name,
        client_name: record.client_name,
      });
    } else if (
      finalTemplateName === TEMPLATE_NAME_MAP.supplier_statement_added
    ) {
      parameters = buildSupplierStatementParams({
        supplier_name: record.supplier_name,
        year_month: record.year_month || record.month_year,
        amount: record.amount,
        due_date: record.due_date,
      });
    } else if (
      finalTemplateName === TEMPLATE_NAME_MAP.stock_transaction_created
    ) {
      const transactionType = ["ADDED", "USED", "WASTED"].includes(record.type)
        ? record.type
        : record.transaction_type || "ADDED";
      parameters = buildStockTransactionParams({
        item_name: record.item_name,
        status: transactionType,
        quantity_added: record.quantity,
        dimensions: record.dimensions,
      });
    } else if (finalTemplateName === TEMPLATE_NAME_MAP.assign_installer) {
      parameters = buildAssignInstallerParams({
        installer_name: record.installer_name,
        project_name: record.project_name,
        lot_id: record.lot_id,
        url: "https://ikonickitchens.com.au/admin/site_photos",
      });
    } else if (finalTemplateName === TEMPLATE_NAME_MAP.meeting_confirmation) {
      parameters = buildMeetingConfirmationParams({
        title: record.title,
        project_names: record.project_names,
        lot_id_client: record.lot_id_client,
        date: record.date,
        time: record.time,
        participant1: record.participant1,
        participant2_plus: record.participant2_plus,
        notes: record.notes,
      });
    }
  }

  return { templateName: finalTemplateName, parameters };
}

/**
 * Main notification middleware function
 * Sends WhatsApp notifications to users based on their notification preferences
 * @param {Object} record - The updated record object with the following structure:
 *   - type: string - Type of record (e.g., "material_to_order", "stage", etc.)
 *   - notification_type: string|Array<string> - Explicit notification type(s) to trigger (optional)
 *   - stage_name: string - Stage name if type is "stage" (optional)
 *   - [other fields]: any - Additional record data
 * @param {string} templateName - Optional explicit WhatsApp template name to use (e.g., "stage_completed", "materials_to_order_list_update", etc.)
 * @returns {Promise<Object>} - Result object with success status and details
 *
 * @example
 * // Material to order notification with explicit template
 * await sendNotification({
 *   type: "material_to_order",
 *   materials_to_order_id: "MTO001",
 *   project_id: "IK001",
 *   is_new: true
 * }, "materials_to_order_list_update");
 *
 * @example
 * // Stage update notification
 * await sendNotification({
 *   type: "stage",
 *   stage_name: "drafting",
 *   lot_id: "IK001-lot 1",
 *   status: "COMPLETED"
 * }, "stage_completed");
 *
 * @example
 * // Stock transaction notification
 * await sendNotification({
 *   type: "stock_transaction",
 *   item_id: "ITEM001",
 *   quantity: 10,
 *   transaction_type: "ADDED"
 * }, "stock_transaction_created");
 *
 * @example
 * // Lot installer assigned notification
 * await sendNotification({
 *   type: "assign_installer",
 * }, "assign_installer");
 */

export async function sendNotification(record, templateName = null) {
  if (!record || typeof record !== "object") {
    console.warn("sendNotification: Invalid record provided");
    return {
      success: false,
      error: "Invalid record provided",
      sent: 0,
      failed: 0,
    };
  }

  try {
    // Prepare WhatsApp message template and parameters
    const { templateName: finalTemplateName, parameters } =
      prepareWhatsAppMessage(record, templateName);

    if (!finalTemplateName) {
      console.warn(
        "sendNotification: No template name determined for record",
        record,
      );
      return {
        success: true,
        message: "No template name determined",
        sent: 0,
        failed: 0,
        notificationTypes: [],
      };
    }

    // Get users who should receive notifications (check their notification settings)
    const usersToNotify = await getUsersToNotify(finalTemplateName, record);

    if (usersToNotify.length === 0) {
      console.log(
        "sendNotification: No users to notify for template:",
        finalTemplateName,
      );
      return {
        success: true,
        message:
          "No users to notify (notification settings disabled or no eligible users)",
        sent: 0,
        failed: 0,
        notificationTypes: [finalTemplateName],
      };
    }

    // Send notifications to all eligible users
    const results = await Promise.allSettled(
      usersToNotify.map(async (user) => {
        if (!user.phone) {
          throw new Error(`No phone number for user ${user.userId}`);
        }

        try {
          const response = await sendWhatsAppMessage(
            user.phone,
            finalTemplateName,
            parameters,
          );
          return {
            userId: user.userId,
            phone: user.phone,
            success: true,
            response,
          };
        } catch (error) {
          console.error(
            `Failed to send notification to user ${user.userId}:`,
            error,
          );
          throw error;
        }
      }),
    );

    // Count successes and failures
    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    // Log failures
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          `Notification failed for user ${usersToNotify[index].userId}:`,
          result.reason,
        );
      }
    });

    return {
      success: failed === 0,
      message: `Sent ${successful} notification(s), ${failed} failed`,
      sent: successful,
      failed,
      notificationTypes: [finalTemplateName],
      totalUsers: usersToNotify.length,
      templateName: finalTemplateName,
    };
  } catch (error) {
    console.error("Error in sendNotification:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
      sent: 0,
      failed: 0,
    };
  }
}
