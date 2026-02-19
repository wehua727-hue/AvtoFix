import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Settings2, CheckCircle2 } from 'lucide-react';
import { ExcelImportLatinPreviewDialog } from './ExcelImportLatinPreviewDialog';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Array<{ id: string; name: string }>;
  userId: string;
  onImportComplete: () => void;
  onCategoryCreated?: (category: { id: string; name: string }) => void; // Yangi kategoriya yaratilganda
}

interface ColumnMapping {
  name: number;      // Mahsulot nomi (majburiy)
  code: number;      // Mahsulot kodi (Код)
  catalogNumber: number; // Katalog raqami (№ по каталогу)
  price: number;     // Narxi
  stock: number;     // Ombordagi soni
  category: number;  // Kategoriya
}

interface PreviewData {
  totalRows: number;
  uniqueProducts: number;
  totalVariants: number;
  headers: string[];  // Excel sarlavhalari
  sampleRows: any[][]; // Namuna qatorlar (tahrirlash mumkin)
  detectedMapping: ColumnMapping; // Avtomatik aniqlangan ustunlar
  preview: Array<{
    name: string;
    variantsCount: number;
    totalRows: number;
  }>;
}

interface ImportResult {
  success: boolean;
  message: string;
  totalProducts: number;
  totalVariants: number;
  skippedDuplicates?: number;
  duplicatesList?: Array<{
    name: string;
    code: string;
    catalogNumber: string;
    price: number;
    stock: number;
    existingProductName: string;
    existingStock: number;
  }>;
  errors?: string[];
}

// Ustun nomlari
const COLUMN_LABELS: Record<keyof ColumnMapping, string> = {
  name: 'Mahsulot nomi',
  code: 'Mahsulot kodi',
  catalogNumber: 'Katalog №',
  price: 'Narxi',
  stock: 'Ombordagi soni',
  category: 'Kategoriya',
};

export function ExcelImportModal({ 
  isOpen, 
  onClose, 
  categories, 
  userId,
  onImportComplete,
  onCategoryCreated
}: ExcelImportModalProps) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'settings' | 'importing' | 'result'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string>('');
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Latin konvertatsiya uchun
  const [showLatinDialog, setShowLatinDialog] = useState(false);
  const [hasLatinProducts, setHasLatinProducts] = useState(false);
  const [latinProductsData, setLatinProductsData] = useState<any>(null); // Latin ma'lumotlarini saqlash
  const [isCheckingLatin, setIsCheckingLatin] = useState(false); // Latin tekshirish holati
  
  // Ustun mapping
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    name: -1,
    code: -1,
    catalogNumber: -1,
    price: -1,
    stock: -1,
    category: -1,
  });
  
  // Settings
  const [categoryId, setCategoryId] = useState<string>('');
  const [defaultStock, setDefaultStock] = useState<number>(5);
  
  // Kategoriya qo'shish uchun
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [createCategoryLoading, setCreateCategoryLoading] = useState(false);
  const [createCategoryError, setCreateCategoryError] = useState<string | null>(null);
  const [defaultMultiplier, setDefaultMultiplier] = useState<number | ''>('');
  
  // Tahrirlash uchun state
  const [editedData, setEditedData] = useState<any[][]>([]);
  const [editingCell, setEditingCell] = useState<{row: number, col: number} | null>(null);
  
  // Bulk stock update uchun
  const [bulkStockValue, setBulkStockValue] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Avtomatik aniqlangan mapping ni qo'llash
  useEffect(() => {
    if (previewData?.detectedMapping) {
      setColumnMapping(previewData.detectedMapping);
    }
  }, [previewData]);

  // Debug: hasLatinProducts state o'zgarishini kuzatish
  useEffect(() => {
    console.log('[Latin Check] hasLatinProducts state changed:', hasLatinProducts);
  }, [hasLatinProducts]);

  // editedData o'zgarganda lotin mahsulotlarni qayta tekshirish
  useEffect(() => {
    if (editedData.length > 0 && columnMapping.name >= 0) {
      console.log('[Latin Check] editedData changed, checking for Latin products...');
      
      // editedData ichida lotin mahsulotlar borligini tekshirish
      let hasLatin = false;
      
      for (const row of editedData) {
        if (row && row[columnMapping.name]) {
          const name = String(row[columnMapping.name]).trim();
          if (name) {
            const alphabet = detectAlphabetClient(name);
            if (alphabet === 'latin' || alphabet === 'mixed') {
              hasLatin = true;
              break;
            }
          }
        }
      }
      
      console.log('[Latin Check] Has Latin products in editedData:', hasLatin);
      setHasLatinProducts(hasLatin);
    }
  }, [editedData, columnMapping.name]);

  // Client-side alphabet detection (backend funksiyasining nusxasi)
  const detectAlphabetClient = (text: string): 'latin' | 'cyrillic' | 'mixed' | 'unknown' => {
    if (!text) return 'unknown';
    
    // Birinchi so'zni ajratib olish
    const firstWord = text.trim().split(/[\s\-\.]+/)[0];
    if (!firstWord) return 'unknown';
    
    const hasLatin = /[a-zA-Z]/.test(firstWord);
    const hasCyrillic = /[а-яА-ЯёЁўЎқҚғҒҳҲ]/.test(firstWord);
    
    if (hasLatin && hasCyrillic) return 'mixed';
    if (hasLatin) return 'latin';
    if (hasCyrillic) return 'cyrillic';
    
    return 'unknown';
  };

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setCreateCategoryError('Kategoriya nomi kiritilishi shart');
      return;
    }

    setCreateCategoryLoading(true);
    setCreateCategoryError(null);

    try {
      const payload: any = {
        name,
        userId: userId,
        parentId: null,
        level: 0,
      };

      const res = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Kategoriya yaratishda xatolik');
      }

      const data = await res.json();
      if (!data?.success || !data.category) {
        throw new Error('Kategoriya yaratilmadi');
      }

      // Yangi kategoriyani parent komponentga yuborish
      const newCategory = {
        id: data.category.id,
        name: data.category.name,
      };
      
      if (onCategoryCreated) {
        onCategoryCreated(newCategory);
      }

      // Yangi kategoriyani darhol tanlaymiz
      setCategoryId(newCategory.id);

      // Formani tozalaymiz
      setIsCreatingCategory(false);
      setNewCategoryName('');
      setCreateCategoryError(null);
    } catch (err) {
      console.error('Error creating category:', err);
      setCreateCategoryError(err instanceof Error ? err.message : 'Kategoriya yaratishda xatolik');
    } finally {
      setCreateCategoryLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fayl turini tekshirish
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      '.xlsx',
      '.xls'
    ];
    
    if (!validTypes.some(type => file.type.includes(type) || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      setError('Faqat Excel fayl (.xlsx, .xls) yuklash mumkin');
      return;
    }

    setSelectedFile(file);
    setError('');
    setIsLoading(true);

    try {
      // Faylni Base64 ga aylantirish
      const base64 = await fileToBase64(file);
      setFileData(base64);

      // Preview olish - BARCHA qatorlarni so'rash
      const response = await fetch(`${API_BASE_URL}/api/excel-import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          fileData: base64,
          fullPreview: true, // Barcha qatorlarni so'rash
          maxRows: 1000 // Maksimal 1000 qator
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setPreviewData(data);
        // Tahrirlash uchun ma'lumotlarni nusxalash
        setEditedData(data.sampleRows ? [...data.sampleRows.map((row: any[]) => [...row])] : []);
        
        // Latin mahsulotlar borligini tekshirish - aniqlangan mapping bilan
        if (data.detectedMapping) {
          console.log('[Excel Import] Calling checkForLatinProducts with mapping:', data.detectedMapping);
          await checkForLatinProducts(base64, data.detectedMapping);
          console.log('[Excel Import] checkForLatinProducts completed');
        }
        
        setStep('mapping');
      } else {
        setError(data.error || 'Preview xatosi');
      }
    } catch (err: any) {
      setError(err.message || 'Fayl o\'qishda xatolik');
    } finally {
      setIsLoading(false);
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  // Latin mahsulotlar borligini tekshirish
  const checkForLatinProducts = async (base64Data: string, detectedMapping: ColumnMapping) => {
    setIsCheckingLatin(true);
    try {
      console.log('[Latin Check] Starting with mapping:', detectedMapping);
      console.log('[Latin Check] API URL:', `${API_BASE_URL}/api/excel-import/preview-latin`);
      
      const response = await fetch(`${API_BASE_URL}/api/excel-import/preview-latin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData: base64Data,
          columnMapping: detectedMapping,
        }),
      });

      console.log('[Latin Check] Response status:', response.status);
      console.log('[Latin Check] Response ok:', response.ok);

      if (!response.ok) {
        console.error('[Latin Check] Response not OK:', response.status, response.statusText);
        setHasLatinProducts(false);
        setLatinProductsData(null);
        return;
      }

      const data = await response.json();
      
      console.log('[Latin Check] Response data:', data);
      console.log('[Latin Check] Success:', data.success);
      console.log('[Latin Check] Latin count:', data.latinCount);

      if (data.success && data.latinCount > 0) {
        console.log('[Latin Check] Found', data.latinCount, 'Latin products - SETTING STATE');
        setHasLatinProducts(true);
        setLatinProductsData(data);
        console.log('[Latin Check] State updated - hasLatinProducts should be true');
      } else {
        console.log('[Latin Check] No Latin products found');
        setHasLatinProducts(false);
        setLatinProductsData(null);
      }
    } catch (err) {
      console.error('[Latin Check] Error:', err);
      setHasLatinProducts(false);
      setLatinProductsData(null);
    } finally {
      setIsCheckingLatin(false);
    }
  };

  // Latin konvertatsiya tugmasi bosilganda
  const handleShowLatinDialog = () => {
    console.log('[Excel Import] Opening Latin dialog');
    setShowLatinDialog(true);
  };

  // Konvertatsiya tugallanganda
  const handleLatinConvertComplete = (convertedData: any[][] | null) => {
    setShowLatinDialog(false);
    
    if (convertedData && Array.isArray(convertedData)) {
      console.log('[Excel Import] Received converted data, rows:', convertedData.length);
      
      // convertedData allaqachon to'g'ri formatda (faqat ma'lumot qatorlari)
      setEditedData(convertedData);
      
      console.log('[Excel Import] Updated editedData with converted data');
    }
  };

  const handleColumnChange = (field: keyof ColumnMapping, value: number) => {
    setColumnMapping(prev => ({ ...prev, [field]: value }));
  };

  // Qatorni o'chirish funksiyasi
  const deleteRow = (rowIndex: number) => {
    setEditedData(prev => {
      const newData = [...prev];
      newData.splice(rowIndex, 1); // Qatorni o'chirish
      return newData;
    });
    
    // Statistikani yangilash
    if (previewData) {
      const newTotalRows = editedData.length - 1;
      setPreviewData(prev => prev ? {
        ...prev,
        totalRows: newTotalRows,
        sampleRows: prev.sampleRows.filter((_, idx) => idx !== rowIndex)
      } : null);
    }
  };
  
  // Yangi qator qo'shish funksiyasi
  const addNewRow = () => {
    const newRowIndex = editedData.length;
    
    setEditedData(prev => {
      const newData = [...prev];
      // Bo'sh qator yaratish - barcha ustunlar uchun bo'sh qiymat
      const emptyRow = previewData?.headers?.map(() => '') || [];
      newData.push(emptyRow);
      return newData;
    });
    
    // Statistikani yangilash
    if (previewData) {
      const newTotalRows = editedData.length + 1;
      setPreviewData(prev => prev ? {
        ...prev,
        totalRows: newTotalRows,
      } : null);
    }
    
    // Yangi qatorning birinchi cellini avtomatik tahrirlash rejimiga o'tkazish
    setTimeout(() => {
      setEditingCell({ row: newRowIndex, col: 0 });
      // Jadval oxiriga scroll qilish
      const tableContainer = document.querySelector('.overflow-auto');
      if (tableContainer) {
        tableContainer.scrollTop = tableContainer.scrollHeight;
      }
    }, 100);
  };
  
  const handleCellEdit = (rowIndex: number, colIndex: number, value: string) => {
    setEditedData(prev => {
      const newData = [...prev];
      if (!newData[rowIndex]) {
        newData[rowIndex] = [];
      }
      newData[rowIndex][colIndex] = value;
      return newData;
    });
  };

  // Cell ni tahrirlash rejimiga o'tkazish
  const startEditing = (rowIndex: number, colIndex: number) => {
    setEditingCell({ row: rowIndex, col: colIndex });
  };

  // Tahrirlashni tugatish
  const stopEditing = () => {
    setEditingCell(null);
  };

  // Barcha mahsulotlarning ombordagi sonini o'zgartirish
  const updateAllStock = () => {
    const stockValue = parseInt(bulkStockValue) || 0;
    if (stockValue < 0) return;
    
    if (columnMapping.stock >= 0) {
      // Ombordagi soni ustuni tanlangan - uni ishlatish
      setEditedData(prev => {
        const newData = [...prev];
        for (let i = 0; i < newData.length; i++) {
          if (!newData[i]) newData[i] = [];
          newData[i][columnMapping.stock] = stockValue;
        }
        return newData;
      });
    } else {
      // Ombordagi soni ustuni tanlanmagan - К-во ustunini qidirish
      const stockColumnIndex = previewData?.headers?.findIndex(header => 
        header && (
          header.toLowerCase().includes('к-во') ||
          header.toLowerCase().includes('кол-во') ||
          header.toLowerCase().includes('количество') ||
          header.toLowerCase().includes('soni') ||
          header.toLowerCase().includes('stock')
        )
      );
      
      if (stockColumnIndex !== undefined && stockColumnIndex >= 0) {
        // К-во ustuni topildi - uni ishlatish
        setColumnMapping(prev => ({ ...prev, stock: stockColumnIndex }));
        
        setEditedData(prev => {
          const newData = [...prev];
          for (let i = 0; i < newData.length; i++) {
            if (!newData[i]) newData[i] = [];
            newData[i][stockColumnIndex] = stockValue;
          }
          return newData;
        });
      } else {
        // К-во ustuni topilmadi - yangi ustun qo'shish
        if (previewData?.headers) {
          const newHeaders = [...previewData.headers, 'Ombordagi soni'];
          const newColumnIndex = newHeaders.length - 1;
          
          setColumnMapping(prev => ({ ...prev, stock: newColumnIndex }));
          setPreviewData(prev => prev ? { ...prev, headers: newHeaders } : null);
          
          setEditedData(prev => {
            const newData = [...prev];
            for (let i = 0; i < newData.length; i++) {
              if (!newData[i]) newData[i] = [];
              newData[i][newColumnIndex] = stockValue;
            }
            return newData;
          });
        }
      }
    }
    
    setBulkStockValue('');
    setError('');
  };

  const handleImport = async () => {
    if (!fileData) return;

    // Majburiy maydonlarni tekshirish
    if (columnMapping.name === -1) {
      setError('Mahsulot nomi ustunini tanlang');
      return;
    }

    setStep('importing');
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/excel-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileData,
          editedData, // Tahrirlangan ma'lumotlarni yuborish
          columnMapping, // Ustun mapping yuborish
          categoryId: categoryId || undefined,
          userId,
          defaultStock,
          defaultMultiplier: defaultMultiplier || 30, // Default 30 if empty
          defaultCurrency: 'USD',
          defaultStatus: 'available',
        }),
      });

      const data = await response.json();
      
      console.log('[Excel Import] Response data:', data);
      console.log('[Excel Import] duplicatesList:', data.duplicatesList);
      
      setImportResult({
        success: data.success,
        message: data.message || (data.success ? 'Import muvaffaqiyatli' : 'Import xatosi'),
        totalProducts: data.totalProducts || 0,
        totalVariants: data.totalVariants || 0,
        skippedDuplicates: data.skippedDuplicates || 0,
        duplicatesList: data.duplicatesList || [],
        errors: data.errors,
      });
      
      setStep('result');
      
      if (data.success) {
        onImportComplete();
      }
    } catch (err: any) {
      setImportResult({
        success: false,
        message: err.message || 'Import xatosi',
        totalProducts: 0,
        totalVariants: 0,
      });
      setStep('result');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setFileData('');
    setPreviewData(null);
    setImportResult(null);
    setError('');
    setCategoryId('');
    setDefaultStock(5);
    setDefaultMultiplier('');
    setEditedData([]); // Tahrirlangan ma'lumotlarni tozalash
    setEditingCell(null); // Tahrirlash holatini tozalash
    setBulkStockValue(''); // Bulk stock value ni tozalash
    setShowLatinDialog(false); // Latin dialog ni yopish
    setHasLatinProducts(false); // Latin mahsulotlar holatini tozalash
    setColumnMapping({
      name: -1,
      code: -1,
      catalogNumber: -1,
      price: -1,
      stock: -1,
      category: -1,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[10001] bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          className="w-full h-full bg-card shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border flex-shrink-0 bg-muted/20">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-green-500" />
              <h3 className="text-lg font-semibold text-foreground">Excel Import</h3>
              {selectedFile && (
                <span className="text-xs text-muted-foreground ml-2 px-2 py-1 bg-muted rounded">
                  {selectedFile.name}
                </span>
              )}
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <div className="p-3 h-full overflow-y-auto bg-background">
            {/* Upload Step */}
            {step === 'upload' && (
              <div key="upload-step" className="space-y-6 max-w-2xl mx-auto">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-2xl p-12 text-center cursor-pointer hover:border-green-500/50 hover:bg-green-500/5 transition-all"
                >
                  <Upload className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg text-foreground font-medium mb-2">
                    Excel faylni tanlang
                  </p>
                  <p className="text-sm text-muted-foreground">
                    .xlsx yoki .xls formatda
                  </p>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {isLoading && (
                  <div className="flex items-center justify-center gap-3 text-muted-foreground py-8">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span className="text-base">Fayl o'qilmoqda...</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}

            {/* Mapping Step - Ustunlarni tanlash */}
            {step === 'mapping' && previewData && (
              <div key="mapping-step" className="h-full flex flex-col">
                {/* Statistika - kichik */}
                <div className="grid grid-cols-3 gap-3 mb-3 flex-shrink-0">
                  <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                    <p className="text-lg font-bold text-blue-400">{previewData.totalRows}</p>
                    <p className="text-xs text-muted-foreground">Jami qator</p>
                  </div>
                  <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/30 text-center">
                    <p className="text-lg font-bold text-green-400">{previewData.uniqueProducts}</p>
                    <p className="text-xs text-muted-foreground">Mahsulot</p>
                  </div>
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-center">
                    <p className="text-lg font-bold text-amber-400">{previewData.totalVariants}</p>
                    <p className="text-xs text-muted-foreground">Xil</p>
                  </div>
                </div>

                {/* Ustunlarni tanlash - kichik */}
                <div className="p-3 rounded-lg bg-muted/30 border border-border mb-3 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings2 className="w-4 h-4 text-green-500" />
                    <p className="text-sm font-semibold text-foreground">Ustunlarni tanlang</p>
                    
                    {/* Latin konvertatsiya tugmasi - DOIMO KO'RINADI */}
                    <button
                      onClick={handleShowLatinDialog}
                      disabled={isCheckingLatin}
                      className={`ml-auto px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-all flex items-center gap-2 ${
                        isCheckingLatin 
                          ? 'bg-gray-500 cursor-wait' 
                          : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500'
                      }`}
                    >
                      {isCheckingLatin ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Tekshirilmoqda...</span>
                        </>
                      ) : (
                        <>
                          <span>🔤</span>
                          <span>Lotin → Kiril</span>
                        </>
                      )}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-6 gap-2">
                    {(Object.keys(COLUMN_LABELS) as Array<keyof ColumnMapping>).map((field) => (
                      <div key={field}>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                          {COLUMN_LABELS[field]} {field === 'name' && <span className="text-red-400">*</span>}
                        </label>
                        <select
                          value={columnMapping[field]}
                          onChange={(e) => handleColumnChange(field, Number(e.target.value))}
                          className={`w-full px-2 py-1 rounded text-xs border focus:outline-none focus:ring-1 focus:ring-green-500/50 ${
                            columnMapping[field] >= 0 ? 'border-green-500/50 text-foreground bg-card' : 'border-border text-muted-foreground bg-muted'
                          }`}
                        >
                          <option value={-1}>-- Tanlanmagan --</option>
                          {previewData.headers?.map((header, idx) => (
                            <option key={`option-${idx}`} value={idx}>
                              {header || `Ustun ${idx + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Jadval - maksimal joy */}
                {previewData.sampleRows && previewData.sampleRows.length > 0 && (
                  <div className="flex-1 border border-border rounded-lg bg-card overflow-hidden flex flex-col">
                    <div className="p-3 bg-muted/30 border-b border-border flex-shrink-0">
                      <div className="flex flex-col gap-3">
                        <div>
                          <p className="text-sm font-medium text-foreground">Barcha {previewData.sampleRows.length} ta qator (tahrirlash mumkin)</p>
                          <p className="text-xs text-muted-foreground">Cell ustiga ikki marta bosing tahrirlash uchun</p>
                        </div>
                        
                        {/* KATTA Bulk Stock Update - HAR DOIM KO'RINADI */}
                        <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                          <span className="text-sm font-medium text-green-400">Barcha mahsulotning ombordagi soni:</span>
                          <input
                            type="number"
                            value={bulkStockValue}
                            onChange={(e) => setBulkStockValue(e.target.value)}
                            placeholder="Masalan: 5"
                            min="0"
                            className="w-24 px-3 py-2 text-sm border border-green-500/50 rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50 font-medium"
                          />
                          <button
                            onClick={updateAllStock}
                            disabled={!bulkStockValue || parseInt(bulkStockValue) < 0}
                            className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:bg-gray-500 disabled:cursor-not-allowed transition-colors font-medium"
                          >
                            Barcha mahsulotga qo'llash
                          </button>
                          {columnMapping.stock < 0 && (
                            <span className="text-xs text-amber-400">⚠️ "К-во" ustuni qidiriladi yoki yangi ustun qo'shiladi</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 overflow-auto overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead className="sticky top-0 bg-muted/95 backdrop-blur-sm">
                          <tr>
                            {/* O'chirish ustuni qo'shish */}
                            <th className="px-2 py-1.5 text-center border-r border-border font-semibold text-foreground bg-muted/95 w-[40px]">
                              №
                            </th>
                            {previewData.headers?.map((header, idx) => (
                              <th key={`header-${idx}`} className="px-2 py-1.5 text-left border-r border-border font-semibold text-foreground bg-muted/95 whitespace-nowrap min-w-[80px]">
                                {header || `Ustun ${idx + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {editedData.map((row, rowIdx) => (
                            <tr key={`row-${rowIdx}`} className="hover:bg-muted/20 border-b border-border/50">
                              {/* O'chirish tugmasi */}
                              <td className="px-2 py-1.5 text-center border-r border-border w-[40px]">
                                <button
                                  onClick={() => deleteRow(rowIdx)}
                                  className="w-6 h-6 flex items-center justify-center text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                                  title="Qatorni o'chirish"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </td>
                              {row.map((cell: any, cellIdx: number) => (
                                <td key={`cell-${rowIdx}-${cellIdx}`} className="px-2 py-1.5 border-r border-border text-foreground min-w-[80px]">{editingCell?.row === rowIdx && editingCell?.col === cellIdx ? (
                                    <input
                                      type="text"
                                      defaultValue={cell || ''}
                                      autoFocus
                                      className="w-full bg-transparent border-none outline-none text-foreground"
                                      onBlur={(e) => {
                                        handleCellEdit(rowIdx, cellIdx, e.target.value);
                                        stopEditing();
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          handleCellEdit(rowIdx, cellIdx, e.currentTarget.value);
                                          stopEditing();
                                        }
                                        if (e.key === 'Escape') {
                                          stopEditing();
                                        }
                                      }}
                                    />
                                  ) : (
                                    <div 
                                      className="whitespace-nowrap overflow-hidden text-ellipsis cursor-pointer hover:bg-blue-500/10 rounded px-1 py-0.5"
                                      title={cell?.toString() || '-'}
                                      onDoubleClick={() => startEditing(rowIdx, cellIdx)}
                                    >
                                      {cell ?? '-'}
                                    </div>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    {/* Yangi qator qo'shish tugmasi */}
                    <div className="p-3 bg-muted/30 border-t border-border flex-shrink-0">
                      <button
                        onClick={addNewRow}
                        className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors font-medium text-sm flex items-center justify-center gap-2"
                      >
                        <span className="text-lg">+</span>
                        Yangi qator qo'shish
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-2 p-2 mt-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex-shrink-0">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Tugmalar - kichik */}
                <div className="flex gap-2 mt-3 flex-shrink-0">
                  <button
                    onClick={() => {
                      setStep('upload');
                      setError('');
                    }}
                    className="flex-1 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
                  >
                    Orqaga
                  </button>
                  <button
                    onClick={() => {
                      if (columnMapping.name === -1) {
                        setError('Mahsulot nomi ustunini tanlang');
                        return;
                      }
                      setError('');
                      setStep('settings');
                    }}
                    className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors"
                  >
                    Davom etish
                  </button>
                </div>
              </div>
            )}

            {/* Settings Step */}
            {step === 'settings' && (
              <div key="settings-step" className="space-y-6 max-w-4xl mx-auto">
                {/* Tanlangan ustunlar */}
                <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/30">
                  <p className="text-sm font-medium text-green-400 mb-3">Tanlangan ustunlar:</p>
                  <div className="flex flex-wrap gap-3">
                    {(Object.keys(COLUMN_LABELS) as Array<keyof ColumnMapping>).map((field) => (
                      columnMapping[field] >= 0 && (
                        <span key={field} className="px-3 py-2 rounded-xl bg-green-500/20 text-sm text-green-300 font-medium">
                          {COLUMN_LABELS[field]}: {previewData?.headers?.[columnMapping[field]] || `Ustun ${columnMapping[field] + 1}`}
                        </span>
                      )
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-base font-medium text-foreground">
                      Kategoriya
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingCategory(true);
                        setNewCategoryName('');
                        setCreateCategoryError(null);
                      }}
                      className="px-3 py-1.5 text-sm rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors flex items-center gap-1.5"
                    >
                      <span className="text-lg">+</span>
                      Yangi kategoriya
                    </button>
                  </div>
                  
                  {/* Yangi kategoriya qo'shish formasi */}
                  {isCreatingCategory && (
                    <div className="mb-3 p-3 bg-muted/50 rounded-lg border border-border space-y-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => {
                          setNewCategoryName(e.target.value);
                          setCreateCategoryError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateCategory();
                          }
                        }}
                        placeholder="Kategoriya nomi"
                        className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50"
                        disabled={createCategoryLoading}
                        autoFocus
                      />
                      {createCategoryError && (
                        <p className="text-xs text-red-500">{createCategoryError}</p>
                      )}
                      <div className="flex gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingCategory(false);
                            setNewCategoryName('');
                            setCreateCategoryError(null);
                          }}
                          className="px-3 py-1.5 text-sm rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border transition-colors"
                          disabled={createCategoryLoading}
                        >
                          Bekor qilish
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCategory}
                          className="px-3 py-1.5 text-sm rounded-lg bg-green-600 hover:bg-green-500 text-white transition-colors"
                          disabled={createCategoryLoading || !newCategoryName.trim()}
                        >
                          {createCategoryLoading ? 'Saqlanmoqda...' : 'Saqlash'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  >
                    <option value="">Kategoriyasiz</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-base font-medium text-foreground mb-3">
                    Foiz (%)
                  </label>
                  <input
                    type="number"
                    placeholder="Masalan: 30"
                    value={defaultMultiplier}
                    onChange={(e) => setDefaultMultiplier(Number(e.target.value) || '')}
                    min={0}
                    max={100}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/50"
                  />
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => setStep('mapping')}
                    className="flex-1 py-3 rounded-xl bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors"
                  >
                    Orqaga
                  </button>
                  <button
                    onClick={handleImport}
                    className="flex-1 py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
                  >
                    Import qilish
                  </button>
                </div>
              </div>
            )}

            {/* Importing Step */}
            {step === 'importing' && (
              <div key="importing-step" className="py-16 text-center max-w-md mx-auto">
                <Loader2 className="w-16 h-16 mx-auto text-green-500 animate-spin mb-6" />
                <p className="text-xl text-foreground font-medium mb-2">Import qilinmoqda...</p>
                <p className="text-muted-foreground">Iltimos, kuting</p>
              </div>
            )}

            {/* Result Step */}
            {step === 'result' && importResult && (
              <div key="result-step" className="space-y-6 w-full px-4">
                <div className={`p-8 rounded-2xl text-center max-w-2xl mx-auto ${
                  importResult.success 
                    ? 'bg-green-500/10 border border-green-500/30' 
                    : 'bg-red-500/10 border border-red-500/30'
                }`}>
                  {importResult.success ? (
                    <Check className="w-16 h-16 mx-auto text-green-500 mb-4" />
                  ) : (
                    <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                  )}
                  <p className={`text-lg font-medium ${importResult.success ? 'text-green-400' : 'text-red-400'}`}>
                    {importResult.message}
                  </p>
                </div>

                {importResult.success && (
                  <div className="grid grid-cols-2 gap-6 max-w-2xl mx-auto">
                    <div className="p-6 rounded-2xl bg-green-500/10 border border-green-500/30 text-center">
                      <p className="text-4xl font-bold text-green-400 mb-2">{importResult.totalProducts}</p>
                      <p className="text-sm text-muted-foreground">Mahsulot</p>
                    </div>
                    <div className="p-6 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center">
                      <p className="text-4xl font-bold text-amber-400 mb-2">{importResult.totalVariants}</p>
                      <p className="text-sm text-muted-foreground">Xil</p>
                    </div>
                  </div>
                )}

                {/* Dublikat mahsulotlar jadvali */}
                {importResult.duplicatesList && importResult.duplicatesList.length > 0 && (
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/30 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-red-400">
                          Dublikat mahsulotlar
                        </h3>
                        <p className="text-sm text-red-300/70">
                          {importResult.duplicatesList.length} ta mahsulot saytda mavjud bo'lgani uchun o'tkazib yuborildi
                        </p>
                      </div>
                    </div>
                    
                    <div className="max-h-[450px] overflow-auto rounded-xl border border-red-500/20 bg-black/20">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gradient-to-r from-red-500/30 to-orange-500/30 backdrop-blur-md z-10">
                          <tr className="border-b border-red-500/30">
                            <th className="px-3 py-3 text-left text-red-200 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">№</th>
                            <th className="px-3 py-3 text-left text-red-200 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">Mahsulot nomi</th>
                            <th className="px-3 py-3 text-left text-red-200 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">Kod</th>
                            <th className="px-3 py-3 text-left text-red-200 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">Katalog</th>
                            <th className="px-3 py-3 text-right text-red-200 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">Narx</th>
                            <th className="px-3 py-3 text-center text-red-200 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">Ombordagi soni</th>
                            <th className="px-3 py-3 text-left text-red-200 font-bold text-[10px] uppercase tracking-wider whitespace-nowrap">Saytda mavjud</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-500/10">
                          {importResult.duplicatesList.map((dup, idx) => (
                            <tr key={idx} className="hover:bg-red-500/10 transition-colors group">
                              <td className="px-3 py-3 text-red-300/80 font-medium whitespace-nowrap">{idx + 1}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="text-red-100 font-medium group-hover:text-red-50 transition-colors max-w-xs truncate">
                                  {dup.name}
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="inline-block px-2 py-1 rounded-md bg-red-500/10 text-red-200 text-xs font-mono">
                                  {dup.code || '-'}
                                </span>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="inline-block px-2 py-1 rounded-md bg-orange-500/10 text-orange-200 text-xs font-mono">
                                  {dup.catalogNumber || '-'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <span className="text-red-200 font-semibold">
                                  {dup.price ? `${dup.price.toLocaleString()} USD` : '-'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-2">
                                  <span className="inline-block px-2 py-1 rounded-md bg-blue-500/10 text-blue-200 text-xs font-semibold">
                                    {dup.existingStock ?? 0}
                                  </span>
                                </div>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                                  <span className="text-red-300/90 text-xs max-w-xs truncate">
                                    {dup.existingProductName}
                                  </span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    
                    <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <p className="text-xs text-red-300/80 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Bu mahsulotlar saytda allaqachon mavjud bo'lgani uchun qayta qo'shilmadi
                      </p>
                    </div>
                  </div>
                )}

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400 space-y-2">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx}>{err}</p>
                    ))}
                  </div>
                )}

                <div className="max-w-2xl mx-auto">
                  <button
                    onClick={handleClose}
                    className="w-full py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-500 transition-colors"
                  >
                    Yopish
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
      
    {/* Latin Preview Dialog - AnimatePresence tashqarisida */}
    <ExcelImportLatinPreviewDialog
      isOpen={showLatinDialog}
      onClose={() => setShowLatinDialog(false)}
      fileData={fileData}
      editedData={editedData}
      columnMapping={columnMapping}
      onConvertComplete={handleLatinConvertComplete}
    />
  </>
  );
}
