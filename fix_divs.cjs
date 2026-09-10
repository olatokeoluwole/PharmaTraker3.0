const fs = require('fs');
function fixFile(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(
    /className="w-full pl-8 pr-2 py-1\.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"[\s\S]*?\/>\s*<\/div>\s*\/>\s*<\/div>\s*<\/div>/,
    `className="w-full pl-8 pr-2 py-1.5 border border-slate-300 rounded text-xs bg-white focus:outline-none"
            />
            </div>
          </div>
        </div>`
  );
  fs.writeFileSync(file, code);
}
fixFile('src/components/DoctorView.tsx');
fixFile('src/components/HMOView.tsx');
