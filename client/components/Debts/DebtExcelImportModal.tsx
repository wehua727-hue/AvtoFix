import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { addDebt } from '@/services/debtService';

interface DebtExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

interface DebtData {
  id: number;
  creditor: string;
  phone: string;
  amount: number;
  currency: string;
  debtDate: string;
  dueDate: string;
  description: string;
}

interface ImportResult {
  success: boolean;
  message: string;
  successCount: number;
  errorCount: number;
  errors?: string[];
}

export function DebtExcelImportModal({ 
  isOpen, 
  onClose, 
  onImportComplete
}: DebtExcelImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [editedData, setEditedData] = useState<DebtData[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{row: number, field: keyof DebtData} | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Modal yopilganda state ni tozalash
  useEffect(() => {
    if (!isOpen) {
      setStep('upload');
      setSelectedFile(null);
      setEditedData([]);
      setImportResult(null);
      setError('');
      setIsLoading(false);
      setEditingCell(null);
      setEditValue('');
    }
  }, [isOpen]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setError('Faqat Excel fayllarini (.xlsx, .xls) yuklash mumkin');
      return;
    }

    setSelectedFile(file);
    setError('');
    parseExcelFile(file);
  };

  const parseExcelFile = (file: File) => {
    setIsLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        import('xlsx').then((XLSX) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          // Birinchi qatorni header sifatida olib tashlash
          const [, ...rows] = jsonData as any[][];
          
          // Ma'lumotlarni obyekt ko'rinishiga o'tkazish
          const parsedData: DebtData[] = rows.map((row: any[], index: number) => ({
            id: index + 1,
            creditor: row[1] || '',
            phone: row[2] || '',
            amount: parseFloat(row[3]?.toString().replace(/,/g, '') || '0'),
            currency: row[4] || 'UZS',
            debtDate: row[5] || new Date().toLocaleDateString('uz-UZ'),
            dueDate: row[6] || '',
            description: row[8] || ''
          })).filter(item => item.creditor.trim() !== '');

          setEditedData([...parsedData]);
          setStep('preview');
          setIsLoading(false);
          
          toast({
            title: 'Muvaffaqiyatli',
            description: `${parsedData.length} ta qarz ma'lumoti o'qildi`
          });
        });
      } catch (error) {
        console.error('Excel fayl o\'qishda xatolik:', error);
        setError('Excel faylni o\'qishda xatolik yuz berdi');
        setIsLoading(false);
      }
    };
    
    reader.readAsArrayBuffer(file);
  };

  const handleCellDoubleClick = (rowIndex: number, field: keyof DebtData) => {
    setEditingCell({ row: rowIndex, field });
    setEditValue(String(editedData[rowIndex][field]));
  };

  const handleCellEdit = (value: string) => {
    if (!editingCell) return;
    
    const newData = [...editedData];
    const { row, field } = editingCell;
    
    if (field === 'amount') {
      newData[row][field] = parseFloat(value.replace(/,/g, '') || '0');
    } else {
      (newData[row] as any)[field] = value;
    }
    
    setEditedData(newData);
    setEditingCell(null);
    setEditValue('');
  };

  const handleAddRow = () => {
    const newRow: DebtData = {
      id: editedData.length + 1,
      creditor: '',
      phone: '',
      amount: 0,
      currency: 'UZS',
      debtDate: new Date().toLocaleDateString('uz-UZ'),
      dueDate: '',
      description: ''
    };
    
    setEditedData([...editedData, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    const newData = editedData.filter((_, i) => i !== index);
    setEditedData(newData);
  };

  const handleImportDebts = async () => {
    if (editedData.length === 0) {
      setError('Import qilish uchun ma\'lumot topilmadi');
      return;
    }

    setStep('importing');
    setIsLoading(true);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const debtItem of editedData) {
        try {
          // Bo'sh qatorlarni o'tkazib yuborish
          if (!debtItem.creditor.trim()) continue;
          
          // Sanalarni to'g'ri formatga o'tkazish
          let debtDate = new Date().toISOString();
          let dueDate = '';

          if (debtItem.debtDate) {
            const parsedDebtDate = new Date(debtItem.debtDate);
            if (!isNaN(parsedDebtDate.getTime())) {
              debtDate = parsedDebtDate.toISOString();
            }
          }

          if (debtItem.dueDate) {
            const parsedDueDate = new Date(debtItem.dueDate);
            if (!isNaN(parsedDueDate.getTime())) {
              dueDate = parsedDueDate.toISOString();
            }
          }

          const result = await addDebt({
            creditor: debtItem.creditor,
            phone: debtItem.phone,
            amount: debtItem.amount,
            currency: debtItem.currency,
            debtDate,
            dueDate,
            description: debtItem.description
          });

          if (result.success) {
            successCount++;
          } else {
            errorCount++;
            errors.push(`${debtItem.creditor}: ${result.message || 'Noma\'lum xatolik'}`);
          }
        } catch (error: any) {
          errorCount++;
          errors.push(`${debtItem.creditor}: ${error.message || 'Noma\'lum xatolik'}`);
        }
      }

      setImportResult({
        success: successCount > 0,
        message: `${successCount} ta qarz muvaffaqiyatli qo'shildi${errorCount > 0 ? `, ${errorCount} ta xatolik` : ''}`,
        successCount,
        errorCount,
        errors: errors.length > 0 ? errors : undefined
      });

      setStep('result');
      
      if (successCount > 0) {
        onImportComplete();
      }
    } catch (error: any) {
      setImportResult({
        success: false,
        message: 'Import jarayonida xatolik yuz berdi',
        successCount: 0,
        errorCount: editedData.length,
        errors: [error.message || 'Noma\'lum xatolik']
      });
      setStep('result');
    } finally {
      setIsLoading(false);
    }
  };

  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* File Upload */}
      <div className="border-2 border-dashed border-gray-600 rounded-xl p-8 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileSelect}
          className="hidden"
        />
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer flex flex-col items-center gap-4"
        >
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
            <Upload className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <p className="text-lg font-medium text-gray-200">
              Excel faylni tanlang
            </p>
            <p className="text-sm text-gray-400 mt-1">
              .xlsx yoki .xls formatdagi fayllarni qo'llab-quvvatlaydi
            </p>
          </div>
          {selectedFile && (
            <div className="bg-gray-800/50 px-4 py-2 rounded-lg">
              <p className="text-sm text-green-400">✓ {selectedFile.name}</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Format Guide */}
      <div className="bg-gray-800/30 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Excel fayl formati:</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-300 font-medium mb-2">Ustunlar tartibi:</p>
            <ul className="space-y-1 text-gray-400">
              <li>1. T/r (ixtiyoriy)</li>
              <li>2. Qarzdor ismi (majburiy)</li>
              <li>3. Telefon raqami</li>
              <li>4. Qarz miqdori (majburiy)</li>
              <li>5. Valyuta (UZS, USD, RUB, CNY)</li>
            </ul>
          </div>
          <div>
            <p className="text-gray-300 font-medium mb-2">Qo'shimcha ustunlar:</p>
            <ul className="space-y-1 text-gray-400">
              <li>6. Qarz sanasi (DD.MM.YYYY)</li>
              <li>7. To'lov muddati (DD.MM.YYYY)</li>
              <li>8. Holati (ixtiyoriy)</li>
              <li>9. Izoh</li>
            </ul>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}
    </div>
  );

  const renderPreviewStep = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-200">
          Ma'lumotlar ko'rinishi ({editedData.length} ta qarz)
        </h3>
        <Button
          onClick={handleAddRow}
          className="bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Yangi qator
        </Button>
      </div>

      <div className="bg-gray-800/30 rounded-xl p-4">
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-800">
              <tr className="border-b border-gray-600">
                <th className="text-left p-2 text-gray-300">T/r</th>
                <th className="text-left p-2 text-gray-300">Qarzdor ismi</th>
                <th className="text-left p-2 text-gray-300">Telefon</th>
                <th className="text-left p-2 text-gray-300">Miqdor</th>
                <th className="text-left p-2 text-gray-300">Valyuta</th>
                <th className="text-left p-2 text-gray-300">Qarz sanasi</th>
                <th className="text-left p-2 text-gray-300">To'lov muddati</th>
                <th className="text-left p-2 text-gray-300">Izoh</th>
                <th className="text-left p-2 text-gray-300">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {editedData.map((item, index) => (
                <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/20">
                  <td className="p-2 text-gray-400">{index + 1}</td>
                  {(['creditor', 'phone', 'amount', 'currency', 'debtDate', 'dueDate', 'description'] as const).map((field) => (
                    <td 
                      key={field}
                      className="p-2 text-gray-200 cursor-pointer hover:bg-gray-600/20 rounded"
                      onDoubleClick={() => handleCellDoubleClick(index, field)}
                    >
                      {editingCell?.row === index && editingCell?.field === field ? (
                        <input
                          type={field === 'amount' ? 'number' : 'text'}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => handleCellEdit(editValue)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleCellEdit(editValue);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full bg-gray-700 text-gray-200 px-2 py-1 rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <span className="block truncate max-w-32">
                          {field === 'amount' ? item[field].toLocaleString() : String(item[field])}
                        </span>
                      )}
                    </td>
                  ))}
                  <td className="p-2">
                    <Button
                      onClick={() => handleDeleteRow(index)}
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-blue-400" />
          <p className="text-blue-400 text-sm">
            Katakni ikki marta bosing tahrirlash uchun. Yangi qator qo'shish uchun "Yangi qator" tugmasini bosing.
          </p>
        </div>
      </div>
    </div>
  );

  const renderImportingStep = () => (
    <div className="text-center py-8">
      <Loader2 className="w-12 h-12 text-blue-400 animate-spin mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-200 mb-2">Import qilinmoqda...</h3>
      <p className="text-gray-400">Iltimos, kuting...</p>
    </div>
  );

  const renderResultStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
          importResult?.success ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {importResult?.success ? (
            <Check className="w-8 h-8 text-green-400" />
          ) : (
            <AlertCircle className="w-8 h-8 text-red-400" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-200 mb-2">
          {importResult?.success ? 'Import yakunlandi' : 'Import xatosi'}
        </h3>
        <p className="text-gray-400">{importResult?.message}</p>
      </div>

      {importResult?.errors && importResult.errors.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
          <h4 className="text-red-400 font-medium mb-2">Xatolar:</h4>
          <ul className="text-sm text-red-300 space-y-1">
            {importResult.errors.slice(0, 10).map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
            {importResult.errors.length > 10 && (
              <li className="text-red-400">... va yana {importResult.errors.length - 10} ta xato</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl bg-gray-900/95 border-gray-700/50 backdrop-blur-xl rounded-3xl p-6 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gray-100 flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-blue-400" />
            Excel orqali qarz import qilish
          </DialogTitle>
        </DialogHeader>

        <div className="mt-6">
          {step === 'upload' && renderUploadStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'result' && renderResultStep()}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700/50">
          {step === 'upload' && (
            <Button
              variant="outline"
              onClick={onClose}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600"
            >
              Bekor qilish
            </Button>
          )}
          
          {step === 'preview' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('upload')}
                className="bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600"
              >
                Orqaga
              </Button>
              <Button
                onClick={handleImportDebts}
                disabled={editedData.length === 0 || isLoading}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white"
              >
                <Upload className="w-4 h-4 mr-2" />
                {editedData.length} ta qarzni import qilish
              </Button>
            </>
          )}
          
          {step === 'result' && (
            <Button
              onClick={onClose}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white"
            >
              Yopish
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}