"use client";

import jsPDF from "jspdf";
import { useState, useCallback } from "react";
import Tesseract from "tesseract.js";
import * as XLSX from "xlsx";
import { Upload, FileText, FileDigit, FileOutput, FileInput, FileSearch, Languages, Loader2 } from "lucide-react";

export default function OCRConverter() {
  const [image, setImage] = useState(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("eng");
  const [dragActive, setDragActive] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(URL.createObjectURL(file));
    }
  };

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setImage(URL.createObjectURL(file));
    }
  }, []);

  const handleExtractText = async () => {
    if (!image) return;
    setLoading(true);

    try {
      const result = await Tesseract.recognize(image, language, {
        logger: (m) => console.log(m),
      });
      setText(result.data.text);
    } catch (err) {
      console.error("Error extracting text:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadText = () => {
    const blob = new Blob([text], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "extracted-text.txt";
    link.click();
  };

  const handleDownloadPDF = () => {
    const pdf = new jsPDF();
    pdf.text(text, 10, 10);
    pdf.save("extracted-text.pdf");
  };

  const handleDownloadMarkdown = () => {
    const blob = new Blob([text], { type: "text/markdown" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "extracted-text.md";
    link.click();
  };

  const processTextToStructuredData = (rawText) => {
    // Try to detect tables in the text
    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    
    // Table detection - look for lines with consistent separators
    const likelyTableRows = lines.filter(line => 
      line.match(/(\w+\s+){2,}\w+/) || // Multiple words
      line.match(/[|\t]/) // Contains pipes or tabs
    );
    
    if (likelyTableRows.length >= 2) {
      // Try to extract headers from first likely table row
      const headerSeparator = likelyTableRows[0].includes('\t') ? '\t' : 
                            likelyTableRows[0].includes('|') ? '|' : 
                            /\s{2,}/.test(likelyTableRows[0]) ? /\s{2,}/ : ' ';
      
      const headers = likelyTableRows[0].split(headerSeparator)
        .map(h => h.trim())
        .filter(h => h !== '');
      
      if (headers.length > 1) {
        // Process as table data
        return likelyTableRows.slice(1).map(row => {
          const values = row.split(headerSeparator).map(v => v.trim());
          const rowData = {};
          headers.forEach((header, index) => {
            rowData[header || `Column ${index + 1}`] = values[index] || '';
          });
          return rowData;
        });
      }
    }
    
    // Fallback to line-by-line if no table detected
    return lines.map((line, index) => ({
      "Line Number": index + 1,
      "Content": line
    }));
  };

  const handleDownloadExcel = () => {
    try {
      const structuredData = processTextToStructuredData(text);
      
      if (structuredData.length === 0) {
        alert("No structured data found to export");
        return;
      }
      
      // Auto-size columns
      const ws = XLSX.utils.json_to_sheet(structuredData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Extracted Data");
      
      // Calculate column widths
      const colWidths = Object.keys(structuredData[0] || {}).map(key => ({
        wch: Math.max(
          key.length, // Header width
          ...structuredData.map(row => 
            String(row[key] || '').length // Content width
          )
        )
      }));
      
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, "structured-data.xlsx");
    } catch (error) {
      console.error("Error generating Excel file:", error);
      alert("Failed to generate Excel file. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-2">
            <FileSearch className="w-10 h-10 text-orange-500" />
            Image to Text Converter
          </h1>
          <p className="text-gray-600">Extract text from images and export in multiple formats</p>
        </div>

        {/* Upload Area */}
        <div 
          className={`relative border-2 border-dashed rounded-xl p-8 mb-8 text-center transition-all ${dragActive ? "border-orange-500 bg-orange-50" : "border-gray-300 hover:border-orange-400"}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <Upload className="w-12 h-12 text-orange-500" />
            <div>
              <p className="font-medium text-gray-700">Drag & drop an image here</p>
              <p className="text-sm text-gray-500">or</p>
            </div>
            <label className="cursor-pointer bg-orange-500 hover:bg-orange-600 text-white px-6 py-2 rounded-lg shadow-sm transition-colors">
              <span>Browse Files</span>
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="hidden" 
              />
            </label>
            <p className="text-xs text-gray-500">Supports: JPG, PNG, BMP, TIFF</p>
          </div>
        </div>

        {/* Language Selection */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-8">
          <div className="flex items-center gap-2 mb-2">
            <Languages className="text-gray-500" />
            <label className="block text-sm font-medium text-gray-700">OCR Language</label>
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="eng">English</option>
            <option value="ara">Arabic</option>
            <option value="spa">Spanish</option>
            <option value="fra">French</option>
            <option value="deu">German</option>
          </select>
        </div>

        {image && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-8">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-medium text-gray-800 flex items-center gap-2">
                <FileInput className="w-5 h-5" /> Uploaded Image
              </h2>
            </div>
            <div className="p-4 flex flex-col items-center">
              <img src={image} alt="Uploaded" className="max-w-full h-auto max-h-80 rounded-lg shadow" />
              <button
                onClick={handleExtractText}
                disabled={loading}
                className="mt-4 bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg shadow-sm transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  <>
                    <FileSearch className="w-4 h-4" />
                    Extract Text
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {text && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-medium text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5" /> Extracted Text
              </h2>
            </div>
            <div className="p-4">
              <pre className="bg-gray-50 p-4 rounded-lg overflow-auto max-h-96 text-gray-800 font-mono text-sm">
                {text}
              </pre>

              {/* Export Buttons */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={handleDownloadText}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>.TXT</span>
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <FileOutput className="w-4 h-4" />
                  <span>.PDF</span>
                </button>
                <button
                  onClick={handleDownloadMarkdown}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <FileDigit className="w-4 h-4" />
                  <span>.MD</span>
                </button>
                <button
                  onClick={handleDownloadExcel}
                  className="bg-green-100 hover:bg-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
                >
                  <FileDigit className="w-4 h-4" />
                  <span>.XLSX</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}