import React, { useState, useRef } from 'react';
import Papa from 'papaparse';
import { db } from '../db';
import { collection, writeBatch, doc } from '../db';
import { Download, Upload, AlertCircle, CheckCircle2, X } from 'lucide-react';

interface ImportDrugsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ImportDrugsModal({ isOpen, onClose, onSuccess }: ImportDrugsModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8,Name,Category,Unit,CostPrice,SellingPrice,InitialStock\nParacetamol,Analgesic,packs,500,800,100\nAmoxicillin,Antibiotic,cards,1200,1500,50";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pharmacy_inventory_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      
      Papa.parse(selectedFile, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(`Error parsing CSV: ${results.errors[0].message}`);
            return;
          }
          
          const validData = results.data.filter((row: any) => row.Name && row.Category);
          if (validData.length === 0) {
            setError('No valid rows found. Please ensure "Name" and "Category" columns exist and have values.');
            return;
          }
          
          setPreviewData(validData.slice(0, 5)); // Show only first 5 for preview
        },
        error: (err) => {
          setError(`Error reading file: ${err.message}`);
        }
      });
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setIsImporting(true);
    setError(null);

    try {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          try {
            const data = results.data.filter((row: any) => row.Name && row.Category);
            
            // Firestore batched writes limit is 500 operations
            const batches = [];
            let currentBatch = writeBatch(db);
            let currentCount = 0;

            for (const row of data as any[]) {
              if (currentCount === 500) {
                batches.push(currentBatch.commit());
                currentBatch = writeBatch(db);
                currentCount = 0;
              }

              const newDrugRef = doc(collection(db, 'drugs'));
              
              const costPrice = parseFloat(row.CostPrice) || 0;
              const sellingPrice = parseFloat(row.SellingPrice) || 0;
              const initialStock = parseInt(row.InitialStock, 10) || 0;

              currentBatch.set(newDrugRef, {
                name: row.Name.trim(),
                category: row.Category.trim(),
                unit: (row.Unit || 'units').trim(),
                costPrice: costPrice,
                sellingPrice: sellingPrice,
                branchStock: { central: initialStock },
                createdAt: Date.now()
              });

              currentCount++;
            }

            if (currentCount > 0) {
              batches.push(currentBatch.commit());
            }

            await Promise.all(batches);
            
            setIsImporting(false);
            onSuccess();
          } catch (err: any) {
            setError(err.message || 'Error saving data to database');
            setIsImporting(false);
          }
        },
        error: (err) => {
          setError(err.message || 'Error parsing file');
          setIsImporting(false);
        }
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="text-lg font-bold text-slate-800">Import Inventory Data</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
          <div className="bg-blue-50 border border-blue-100 rounded-md p-4 text-sm text-blue-800">
            <h3 className="font-bold flex items-center mb-2">
              <Download className="w-4 h-4 mr-2" /> 
              Step 1: Download Template
            </h3>
            <p className="mb-3">Start by downloading our CSV template. Fill it with your existing data, keeping the exact column headers.</p>
            <button 
              onClick={handleDownloadTemplate}
              className="bg-white border border-blue-200 text-blue-700 px-3 py-1.5 rounded text-xs font-semibold hover:bg-blue-50 transition-colors"
            >
              Download CSV Template
            </button>
          </div>

          <div className="border border-slate-200 rounded-md p-4">
            <h3 className="font-bold text-sm text-slate-800 flex items-center mb-3">
              <Upload className="w-4 h-4 mr-2 text-slate-500" /> 
              Step 2: Upload Data
            </h3>
            
            <input 
              type="file" 
              accept=".csv"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-slate-300 rounded-md p-8 text-center hover:bg-slate-50 hover:border-indigo-400 transition-colors"
            >
              <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <span className="block text-sm font-medium text-slate-700">Click to select your CSV file</span>
              <span className="block text-xs text-slate-500 mt-1">{file ? file.name : "No file selected"}</span>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm flex items-start border border-red-100">
              <AlertCircle className="w-5 h-5 mr-2 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {previewData.length > 0 && !error && (
            <div>
              <h3 className="font-bold text-sm text-slate-800 mb-2 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-2 text-green-600" />
                Data Preview (First {previewData.length} rows)
              </h3>
              <div className="overflow-x-auto border border-slate-200 rounded text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="p-2 font-medium text-slate-600">Name</th>
                      <th className="p-2 font-medium text-slate-600">Category</th>
                      <th className="p-2 font-medium text-slate-600">Cost Price</th>
                      <th className="p-2 font-medium text-slate-600">Selling Price</th>
                      <th className="p-2 font-medium text-slate-600">Initial Stock</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.map((row, i) => (
                      <tr key={i}>
                        <td className="p-2">{row.Name}</td>
                        <td className="p-2">{row.Category}</td>
                        <td className="p-2">{row.CostPrice}</td>
                        <td className="p-2">{row.SellingPrice}</td>
                        <td className="p-2">{row.InitialStock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
          <button 
            onClick={onClose}
            disabled={isImporting}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-sm font-medium hover:bg-slate-100 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleImport}
            disabled={!file || !!error || isImporting}
            className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isImporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin mr-2"></div>
                Importing...
              </>
            ) : (
              'Import Data'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
