import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tss_example", "routes/tss_example.tsx"),
  route("wasd_controls", "routes/wasd_controls.tsx"),
  route("ps5_controls", "routes/ps5_controls.tsx"),
] satisfies RouteConfig;
