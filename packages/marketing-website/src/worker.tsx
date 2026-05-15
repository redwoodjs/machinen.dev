import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/home";
import { LandingLight } from "@/app/pages/landing-light";
import { LandingDark } from "@/app/pages/landing-dark";
import { PrototypeIndex } from "@/app/pages/prototype-index";
import { ZenGardenPage } from "@/app/pages/zen";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/prototypes", PrototypeIndex),
    route("/zen", ZenGardenPage),
    route("/light", LandingLight),
    route("/dark", LandingDark),
  ]),
]);
