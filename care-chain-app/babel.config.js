module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          extensions: [".ios.js", ".android.js", ".js", ".ts", ".tsx", ".json"],
          alias: {
            "@": "./",
            "@/hooks": "./hooks",
            "@/contexts": "./contexts",
            "@/data": "./data",
            "@/services": "./services",
            "@/utils": "./utils",
            "@/config": "./config",
          },
        },
      ],
      "react-native-worklets-core/plugin",
      "react-native-reanimated/plugin",
    ],
  };
};