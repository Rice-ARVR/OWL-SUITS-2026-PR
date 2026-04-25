import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("tss_example", "routes/tss_example.tsx"),
<<<<<<< HEAD
  route("wasd_controls", "routes/wasd_controls.tsx"),
  route("gamepad_controls", "routes/gamepad_controls.tsx"),
=======
>>>>>>> 29c0ad7a275e5dcef28b1acd66d68441b29e08d4
  route("telemetry", "routes/telemetry.tsx"),
] satisfies RouteConfig;
