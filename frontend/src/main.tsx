import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./components/App";
import "normalize.css";
import "@aws-amplify/ui-react/styles.css";
import "./index.css";
import { ThemeProvider, Authenticator } from "@aws-amplify/ui-react";
import { Amplify } from "aws-amplify";
import awsmobile from "./aws-exports.cjs";

import Upload from "./components/Upload";
import Settings from "./components/Settings";
import ErrorPage from "./components/App/ErrorPage";

Amplify.configure(awsmobile);

const theme = {
  name: "workshop-theme",
};

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <ErrorPage />,
    children: [
      {
        index: true,
        element: <Upload />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <Authenticator loginMechanisms={["email"]}>
        <RouterProvider router={router} />
      </Authenticator>
    </ThemeProvider>
  </React.StrictMode>
);
