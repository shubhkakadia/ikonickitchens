import { NextResponse } from "next/server";
import {
  isAdmin,
  isSessionExpired,
} from "../../../../../lib/validators/authFromToken";
import axios from "axios";
import { ensureXeroToken } from "../../../../../lib/xero/getAccessToken";

export async function GET(request) {
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
    const accessToken = await ensureXeroToken();
    const tenantId = process.env.XERO_TENANT_ID;

    console.log("accessToken", accessToken);
    console.log("tenantId", tenantId);

    if (!accessToken || !tenantId) {
      return NextResponse.json(
        { error: "Missing Xero credentials" },
        { status: 500 }
      );
    }

    const response = await axios.get(
      "https://api.xero.com/api.xro/2.0/BankTransactions",
      {
        headers: {
          "xero-tenant-id": tenantId,
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
    return NextResponse.json({
      bankTransactions: response.data?.BankTransactions ?? [],
    });
  } catch (error) {
    console.error("🛑 XERO ERROR DETAILS:");
    console.error("Message:", error.message);
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    console.error("Headers:", error.response?.headers);

    return NextResponse.json(
      {
        status: false,
        message: "Internal server error",
        error: error.message,
        xero: error.response?.data || null,
        code: error.response?.status || 500,
      },
      { status: 500 }
    );
  }
}
