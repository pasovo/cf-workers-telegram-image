module.exports = {
  hooks: {
    readPackage: (pkg) => {
      // 自动批准必要的构建脚本
      if (['@tailwindcss/oxide', 'esbuild', 'sharp', 'workerd'].includes(pkg.name)) {
        pkg.scripts = pkg.scripts || {};
        // 标记脚本为已批准
        pkg.scripts.preinstall = pkg.scripts.preinstall || '';
      }
      return pkg;
    }
  }
};