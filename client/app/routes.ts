import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tss_example", "routes/tss_example.tsx"),
] satisfies RouteConfig;
