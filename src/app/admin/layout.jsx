import "react-toastify/dist/ReactToastify.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Providers from "../providers";

// Redux, redux-persist, auth and toasts are only needed by the admin app.
// Keeping them out of the root layout lets the public marketing pages
// server-render real HTML and skip this bundle.
export default function AdminLayout({ children }) {
  return (
    <Providers>
      <AuthProvider>{children}</AuthProvider>
    </Providers>
  );
}
