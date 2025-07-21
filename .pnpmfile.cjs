module.exports = {
  hooks: {
    readPackage: (pkg) => {
      // 自动批准指定包的构建脚本
      if (["@tailwindcss/oxide", "esbuild", "sharp", "workerd"].includes(pkg.name)) {
        pkg.scripts = pkg.scripts || {};
        // 标记脚本为已批准
        pkg.scripts.preinstall = "exit 0";
      }
      return pkg;
    }
  }
};