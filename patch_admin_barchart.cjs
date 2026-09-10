const fs = require('fs');
let code = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// The script added `<BarChart className="w-3.5 h-3.5" />` which refers to recharts BarChart. We should import BarChart3 from lucide-react.
if (!code.includes("BarChart3")) {
  code = code.replace("import { Package,", "import { Package, BarChart3,");
}
code = code.replace(/<BarChart className="w-3\.5 h-3\.5" \/>/g, '<BarChart3 className="w-3.5 h-3.5" />');

fs.writeFileSync('src/components/AdminView.tsx', code);
console.log("Patched AdminView.tsx icon!");
