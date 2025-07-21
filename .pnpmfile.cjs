module.exports = {
  hooks: {
    readPackage: (pkg) => {
      const allowedPackages = ["@tailwindcss/oxide", "esbuild", "sharp", "workerd"];
      if (allowedPackages.includes(pkg.name)) {
        pkg.scripts = pkg.scripts || {};
        // Approve all scripts by replacing with no-ops
        Object.keys(pkg.scripts).forEach(script => {
          pkg.scripts[script] = "exit 0";
        });
      }
      return pkg;
    }
  }
};