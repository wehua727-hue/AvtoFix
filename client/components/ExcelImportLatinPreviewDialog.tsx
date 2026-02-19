import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertCircle, Languages, ArrowRight } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface LatinProduct {
  rowIndex: number;
  originalName: string;
  cyrillicName: string;
  code: string;
  catalogNumber: string;
  price: number;
  stock: number;
  category: string;
  alphabet: 'latin' | 'cyrillic' | 'mixed' | 'unknown';
}

interface ExcelImportLatinPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  fileData: string;
  editedData: any[][];
  columnMapping: any;
  onConvertComplete: (convertedData: any[][] | null) => void;
}

export function ExcelImportLatinPreviewDialog({
  isOpen,
  onClose,
  fileData,
  editedData,
  columnMapping,
  onConvertComplete,
}: ExcelImportLatinPreviewDialogProps) {
  const [latinProducts, setLatinProducts] = useState<LatinProduct[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'loading' | 'preview' | 'converting' | 'done'>('loading');
  const [totalRows, setTotalRows] = useState(0);
  const [cyrillicCount, setCyrillicCount] = useState(0);

  // Dialog ochilganda yoki editedData o'zgarganda preview olish
  useEffect(() => {
    if (isOpen && editedData && editedData.length > 0) {
      loadLatinPreview();
    }
  }, [isOpen, editedData]);

  const loadLatinPreview = async () => {
    setIsLoading(true);
    setError('');
    setStep('loading');

    try {
      console.log('[Latin Preview Dialog] Loading from editedData, rows:', editedData.length);
      
      // editedData dan lotin mahsulotlarni topish (client-side)
      const latinProds: LatinProduct[] = [];
      let cyrillicCount = 0;
      
      for (let i = 0; i < editedData.length; i++) {
        const row = editedData[i];
        if (!row || !row[columnMapping.name]) continue;
        
        const name = String(row[columnMapping.name]).trim();
        if (!name) continue;
        
        // Birinchi so'zni tekshirish
        const firstWord = name.trim().split(/[\s\-\.]+/)[0];
        if (!firstWord) continue;
        
        const hasLatin = /[a-zA-Z]/.test(firstWord);
        const hasCyrillic = /[а-яА-ЯёЁўЎқҚғҒҳҲ]/.test(firstWord);
        
        let alphabet: 'latin' | 'cyrillic' | 'mixed' | 'unknown' = 'unknown';
        if (hasLatin && hasCyrillic) alphabet = 'mixed';
        else if (hasLatin) alphabet = 'latin';
        else if (hasCyrillic) alphabet = 'cyrillic';
        
        if (alphabet === 'latin' || alphabet === 'mixed') {
          // Lotin mahsulot topildi
          latinProds.push({
            rowIndex: i,
            originalName: name,
            cyrillicName: latinToCyrillicClient(name),
            code: row[columnMapping.code] ? String(row[columnMapping.code]) : '',
            catalogNumber: row[columnMapping.catalogNumber] ? String(row[columnMapping.catalogNumber]) : '',
            price: row[columnMapping.price] ? parseFloat(String(row[columnMapping.price])) : 0,
            stock: row[columnMapping.stock] ? parseInt(String(row[columnMapping.stock])) : 0,
            category: row[columnMapping.category] ? String(row[columnMapping.category]) : '',
            alphabet: alphabet,
          });
        } else if (alphabet === 'cyrillic') {
          cyrillicCount++;
        }
      }
      
      console.log('[Latin Preview Dialog] Found Latin products:', latinProds.length);
      console.log('[Latin Preview Dialog] Found Cyrillic products:', cyrillicCount);
      
      setLatinProducts(latinProds);
      setTotalRows(editedData.length);
      setCyrillicCount(cyrillicCount);
      
      // Barcha lotin mahsulotlarni default tanlangan qilish
      const allIndices = new Set<number>(latinProds.map(p => p.rowIndex));
      setSelectedIndices(allIndices);
      
      setStep('preview');
    } catch (err: any) {
      console.error('[Latin Preview Dialog] Error:', err);
      setError(err.message || 'Preview xatosi');
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  // Client-side lotin → kiril konvertatsiya
  const latinToCyrillicClient = (text: string): string => {
    if (!text) return text;
    
    const map: Record<string, string> = {
      'A': 'А', 'B': 'Б', 'D': 'Д', 'E': 'Е', 'F': 'Ф', 'G': 'Г', 'H': 'Ҳ',
      'I': 'И', 'J': 'Ж', 'K': 'К', 'L': 'Л', 'M': 'М', 'N': 'Н', 'O': 'О',
      'P': 'П', 'Q': 'Қ', 'R': 'Р', 'S': 'С', 'T': 'Т', 'U': 'У', 'V': 'В',
      'X': 'Х', 'Y': 'Й', 'Z': 'З',
      'a': 'а', 'b': 'б', 'd': 'д', 'e': 'е', 'f': 'ф', 'g': 'г', 'h': 'ҳ',
      'i': 'и', 'j': 'ж', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
      'p': 'п', 'q': 'қ', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'v': 'в',
      'x': 'х', 'y': 'й', 'z': 'з',
    };
    
    const digraphs: Record<string, string> = {
      'Sh': 'Ш', 'SH': 'Ш', 'Ch': 'Ч', 'CH': 'Ч',
      'sh': 'ш', 'ch': 'ч',
    };
    
    let result = '';
    let i = 0;
    
    while (i < text.length) {
      let converted = false;
      
      if (i < text.length - 1) {
        const twoChar = text.substring(i, i + 2);
        if (digraphs[twoChar]) {
          result += digraphs[twoChar];
          i += 2;
          converted = true;
        }
      }
      
      if (!converted) {
        const oneChar = text[i];
        result += map[oneChar] || oneChar;
        i++;
      }
    }
    
    return result;
  };

  const toggleSelection = (rowIndex: number) => {
    setSelectedIndices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIndices.size === latinProducts.length) {
      setSelectedIndices(new Set());
    } else {
      const allIndices = new Set(latinProducts.map(p => p.rowIndex));
      setSelectedIndices(allIndices);
    }
  };

  const handleConvert = async () => {
    if (selectedIndices.size === 0) {
      setError('Kamida bitta mahsulot tanlang');
      return;
    }

    setIsLoading(true);
    setError('');
    setStep('converting');

    try {
      console.log('[Latin Preview Dialog] Converting selected rows:', Array.from(selectedIndices));
      
      // editedData ni nusxalash va tanlangan qatorlarni konvertatsiya qilish
      const convertedData = editedData.map((row, index) => {
        if (selectedIndices.has(index) && row[columnMapping.name]) {
          const newRow = [...row];
          newRow[columnMapping.name] = latinToCyrillicClient(String(row[columnMapping.name]));
          return newRow;
        }
        return row;
      });
      
      console.log('[Latin Preview Dialog] Conversion complete');
      
      setStep('done');
      
      // Konvertatsiya qilingan ma'lumotlarni qaytarish
      setTimeout(() => {
        onConvertComplete(convertedData);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('[Latin Preview Dialog] Conversion error:', err);
      setError(err.message || 'Konvertatsiya xatosi');
      setStep('preview');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    // Konvertatsiya qilmasdan davom etish
    onConvertComplete(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[10002] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-5xl bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-blue-500/10 to-purple-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Languages className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Lotin alifbosi aniqlandi</h3>
                <p className="text-sm text-muted-foreground">
                  {latinProducts.length} ta mahsulot lotinda yozilgan
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Loading */}
            {step === 'loading' && (
              <div key="loading-step" className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Lotin mahsulotlar qidirilmoqda...</p>
                </div>
              </div>
            )}

            {/* Preview */}
            {step === 'preview' && (
              <div key="preview-step" className="flex-1 flex flex-col overflow-hidden">
                {/* Statistika */}
                <div className="p-4 bg-muted/30 border-b border-border flex-shrink-0">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                      <p className="text-2xl font-bold text-blue-400">{totalRows}</p>
                      <p className="text-xs text-muted-foreground">Jami mahsulot</p>
                    </div>
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                      <p className="text-2xl font-bold text-amber-400">{latinProducts.length}</p>
                      <p className="text-xs text-muted-foreground">Lotin alifbosida</p>
                    </div>
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                      <p className="text-2xl font-bold text-green-400">{cyrillicCount}</p>
                      <p className="text-xs text-muted-foreground">Kiril alifbosida</p>
                    </div>
                  </div>

                  {latinProducts.length > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedIndices.size === latinProducts.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 rounded border-blue-500/50 text-blue-500 focus:ring-blue-500/50"
                          />
                          <span className="text-sm font-medium text-blue-400">
                            Barchasini tanlash ({selectedIndices.size}/{latinProducts.length})
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          Tanlangan mahsulotlar kirilga o'giriladi
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Jadval */}
                {latinProducts.length > 0 ? (
                  <div className="flex-1 overflow-auto p-4 min-h-0">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-muted/95 backdrop-blur-sm z-10">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-center w-12">
                            <input
                              type="checkbox"
                              checked={selectedIndices.size === latinProducts.length}
                              onChange={toggleSelectAll}
                              className="w-4 h-4 rounded border-border"
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground">Lotin (asl)</th>
                          <th className="px-3 py-2 text-center w-12">
                            <ArrowRight className="w-4 h-4 text-muted-foreground mx-auto" />
                          </th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground">Kiril (yangi)</th>
                          <th className="px-3 py-2 text-left font-semibold text-foreground">Kod</th>
                          <th className="px-3 py-2 text-right font-semibold text-foreground">Narx</th>
                        </tr>
                      </thead>
                      <tbody>
                        {latinProducts.map((product) => (
                          <tr
                            key={product.rowIndex}
                            className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${
                              selectedIndices.has(product.rowIndex) ? 'bg-blue-500/5' : ''
                            }`}
                          >
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIndices.has(product.rowIndex)}
                                onChange={() => toggleSelection(product.rowIndex)}
                                className="w-4 h-4 rounded border-border"
                              />
                            </td>
                            <td className="px-3 py-2 text-foreground font-mono text-xs">
                              {product.originalName}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <ArrowRight className="w-4 h-4 text-blue-400 mx-auto" />
                            </td>
                            <td className="px-3 py-2 text-green-400 font-semibold">
                              {product.cyrillicName}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground text-xs">
                              {product.code || product.catalogNumber || '-'}
                            </td>
                            <td className="px-3 py-2 text-right text-foreground">
                              {product.price ? `${product.price.toLocaleString()} USD` : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center">
                      <Check className="w-16 h-16 text-green-500 mx-auto mb-4" />
                      <p className="text-lg font-medium text-foreground mb-2">
                        Barcha mahsulotlar kiril alifbosida
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Konvertatsiya qilish kerak emas
                      </p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 border-t border-border">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Converting */}
            {step === 'converting' && (
              <div key="converting-step" className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-lg font-medium text-foreground mb-2">
                    Kirilga o'girilmoqda...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedIndices.size} ta mahsulot
                  </p>
                </div>
              </div>
            )}

            {/* Done */}
            {step === 'done' && (
              <div key="done-step" className="flex-1 flex items-center justify-center p-8">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                    <Check className="w-8 h-8 text-green-500" />
                  </div>
                  <p className="text-lg font-medium text-foreground mb-2">
                    Muvaffaqiyatli o'girildi!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedIndices.size} ta mahsulot kiril alifbosiga o'tkazildi
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {step === 'preview' && (
            <div className="p-4 border-t border-border bg-muted/30">
              <div className="flex gap-3">
                <button
                  onClick={handleSkip}
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
                >
                  O'tkazib yuborish
                </button>
                <button
                  onClick={handleConvert}
                  disabled={selectedIndices.size === 0 || isLoading}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {selectedIndices.size > 0
                    ? `${selectedIndices.size} ta mahsulotni kirilga o'girish`
                    : 'Mahsulot tanlanmagan'}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
