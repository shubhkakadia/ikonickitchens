import axios from "axios";
import { setXeroToken } from "../../src/state/reducer/xeroCredentials";

export const ensureXeroToken = () => async (dispatch, getState) => {
  const { access_token, expires_at } = getState().xero;
  if (access_token && Date.now() < expires_at) {
    return access_token;
  }
  const formData = new FormData();
  formData.append("grant_type", "refresh_token");
  formData.append("refresh_token", process.env.NEXT_PUBLIC_XERO_REFRESH_TOKEN);
  formData.append("client_id", process.env.NEXT_PUBLIC_XERO_CLIENT_ID);
  formData.append("client_secret", process.env.NEXT_PUBLIC_XERO_CLIENT_SECRET);

  try {
    const response = await axios.post(
      "https://identity.xero.com/connect/token",
      formData,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    dispatch(
      setXeroToken({
        access_token: response.data.access_token,
        expires_at: Date.now() + 25 * 60 * 1000,
      })
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error ensuring Xero credentials:", error);
    return null;
  }
};
