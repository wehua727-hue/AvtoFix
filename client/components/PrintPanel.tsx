import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Printer,
  RefreshCw,
  Check,
  Wifi,
  Usb,
  Monitor,
  Plus,
  Trash2,
  TestTube,
  Star,
  Settings,
  DollarSign,
} from "lucide-react";

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      printerList: () => Promise<PrinterListResult>;
      printerSetDefault: (printerId: string) => Promise<{ success: boolean }>;
      printerGetDefault: () => Promise<{ printerId: string | null }>;
      printerAddNetwork: (host: string, port: number, name?: string) => Promise<{ success: boolean }>;
      printerRemoveNetwork: (host: string, port: number) => Promise<{ success: boolean }>;
      printerScanNetwork: (subnet: string, startIp: number, endIp: number) => Promise<{ printers: PrinterInfo[] }>;
      printerTest: (printerId: string) => Promise<{ success: boolean; error?: string }>;
      printerPrintReceipt: (printerId: string, receipt: ReceiptData) => Promise<{ success: boolean; error?: string }>;
      printerPrintLabel: (printerId: string, label: LabelData) => Promise<{ success: boolean; error?: string }>;
      printerOpenDrawer: (printerId: string) => Promise<{ success: boolean; error?: string }>;
      printerStatus: (printerId: string) => Promise<{ online: boolean; error?: string }>;
    };
  }
}

interface PrinterInfo {
  id: string;
  type: 'usb' | 'serial' | 'network' | 'windows';
  name: string;
  isDefault?: boolean;
  host?: string;
  port?: number;
  path?: string;
  vendorId?: number;
  productId?: number;
  configured?: boolean;
}

interface PrinterListResult {
  printers: PrinterInfo[];
  defaultPrinterId: string | null;
  error?: string;
}

interface ReceiptData {
  header?: string;
  subheader?: string;
  items?: Array<{ name: string; qty: number; price: number }>;
  subtotal?: number;
  discount?: number;
  total?: number;
  paymentMethod?: string;
  cashReceived?: number;
  change?: number;
  barcode?: string;
  barcodeType?: string;
  qrcode?: string;
  footer?: string;
  openDrawer?: boolean;
}

interface LabelData {
  name?: string;
  price?: number;
  barcode?: string;
  barcodeType?: string;
  sku?: string;
  quantity?: number;
}

const printerTypeIcons: Record<string, React.ReactNode> = {
  usb: <Usb className="w-4 h-4" />,
  serial: <Monitor className="w-4 h-4" />,
  network: <Wifi className="w-4 h-4" />,
  windows: <Printer className="w-4 h-4" />,
};

export default function PrintPanel() {
  const { toast } = useToast();
  const [printers, setPrinters] = useState<PrinterInfo[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [isElectron, setIsElectron] = useState(false);

  // Network printer form
  const [showNetworkForm, setShowNetworkForm] = useState(false);
  const [networkHost, setNetworkHost] = useState("");
  const [networkPort, setNetworkPort] = useState("9100");
  const [networkName, setNetworkName] = useState("");

  // Test receipt data
  const [testItems] = useState([
    { name: "Mahsulot 1", qty: 2, price: 15000 },
    { name: "Mahsulot 2", qty: 1, price: 45000 },
    { name: "Mahsulot 3", qty: 3, price: 8000 },
  ]);

  useEffect(() => {
    const electron = window.electronAPI?.isElectron;
    setIsElectron(!!electron);
    if (electron) {
      loadPrinters();
    }
  }, []);

  const loadPrinters = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI?.printerList();
      if (result) {
        setPrinters(result.printers || []);
        if (result.defaultPrinterId) {
          setSelectedPrinter(result.defaultPrinterId);
        } else if (result.printers?.length > 0) {
          setSelectedPrinter(result.printers[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to load printers:", error);
      toast({
        title: "Xatolik",
        description: "Printerlarni yuklashda xatolik",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };


  const setDefaultPrinter = async () => {
    if (!selectedPrinter) return;
    try {
      const result = await window.electronAPI?.printerSetDefault(selectedPrinter);
      if (result?.success) {
        toast({ title: "Saqlandi", description: "Standart printer o'rnatildi" });
        loadPrinters();
      }
    } catch (error) {
      toast({ title: "Xatolik", description: "Printer saqlanmadi", variant: "destructive" });
    }
  };

  const printTestReceipt = async () => {
    if (!selectedPrinter) {
      toast({ title: "Xatolik", description: "Printer tanlanmagan", variant: "destructive" });
      return;
    }
    
    setTesting(true);
    try {
      const result = await window.electronAPI?.printerTest(selectedPrinter);
      if (result?.success) {
        toast({ title: "Muvaffaqiyat", description: "Test chek chop etildi" });
      } else {
        toast({ title: "Xatolik", description: result?.error || "Chop etishda xatolik", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message || "Chop etishda xatolik", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const printReceipt = async () => {
    if (!selectedPrinter) {
      toast({ title: "Xatolik", description: "Printer tanlanmagan", variant: "destructive" });
      return;
    }

    const receipt: ReceiptData = {
      header: "DO'KON NOMI",
      subheader: "Manzil: Toshkent sh.",
      items: testItems,
      subtotal: testItems.reduce((sum, item) => sum + item.qty * item.price, 0),
      discount: 5000,
      total: testItems.reduce((sum, item) => sum + item.qty * item.price, 0) - 5000,
      paymentMethod: "Naqd",
      cashReceived: 100000,
      change: 100000 - (testItems.reduce((sum, item) => sum + item.qty * item.price, 0) - 5000),
      barcode: "1234567890123",
      barcodeType: "EAN13",
      footer: "Xaridingiz uchun rahmat!",
    };

    setTesting(true);
    try {
      const result = await window.electronAPI?.printerPrintReceipt(selectedPrinter, receipt);
      if (result?.success) {
        toast({ title: "Muvaffaqiyat", description: "Chek chop etildi" });
      } else {
        toast({ title: "Xatolik", description: result?.error || "Chop etishda xatolik", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const printLabel = async () => {
    if (!selectedPrinter) {
      toast({ title: "Xatolik", description: "Printer tanlanmagan", variant: "destructive" });
      return;
    }

    const label: LabelData = {
      name: "Test mahsulot",
      price: 50000,
      barcode: "1234567890",
      barcodeType: "CODE128",
      sku: "TEST-001",
    };

    setTesting(true);
    try {
      const result = await window.electronAPI?.printerPrintLabel(selectedPrinter, label);
      if (result?.success) {
        toast({ title: "Muvaffaqiyat", description: "Senik chop etildi" });
      } else {
        toast({ title: "Xatolik", description: result?.error || "Chop etishda xatolik", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const openCashDrawer = async () => {
    if (!selectedPrinter) return;
    try {
      const result = await window.electronAPI?.printerOpenDrawer(selectedPrinter);
      if (result?.success) {
        toast({ title: "Muvaffaqiyat", description: "Kassa qutisi ochildi" });
      } else {
        toast({ title: "Xatolik", description: result?.error || "Kassa ochilmadi", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  };

  const addNetworkPrinter = async () => {
    if (!networkHost) {
      toast({ title: "Xatolik", description: "IP manzil kiriting", variant: "destructive" });
      return;
    }

    try {
      const result = await window.electronAPI?.printerAddNetwork(
        networkHost,
        parseInt(networkPort) || 9100,
        networkName || undefined
      );
      if (result?.success) {
        toast({ title: "Qo'shildi", description: "Tarmoq printer qo'shildi" });
        setNetworkHost("");
        setNetworkPort("9100");
        setNetworkName("");
        setShowNetworkForm(false);
        loadPrinters();
      }
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  };

  const removeNetworkPrinter = async (printer: PrinterInfo) => {
    if (printer.type !== 'network' || !printer.host) return;
    
    try {
      const result = await window.electronAPI?.printerRemoveNetwork(printer.host, printer.port || 9100);
      if (result?.success) {
        toast({ title: "O'chirildi", description: "Printer o'chirildi" });
        loadPrinters();
      }
    } catch (error: any) {
      toast({ title: "Xatolik", description: error.message, variant: "destructive" });
    }
  };

  if (!isElectron) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="font-semibold text-yellow-800 mb-2">Electron kerak</h3>
          <p className="text-yellow-700 text-sm">
            Printer funksiyalari faqat Electron ilovasida ishlaydi. 
            Iltimos, dasturni Electron rejimida ishga tushiring.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Printer className="w-6 h-6" />
          Printer sozlamalari
        </h2>
        <Button variant="outline" onClick={loadPrinters} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Yangilash
        </Button>
      </div>

      {/* Printer selection */}
      <div className="bg-white border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">Mavjud printerlar</h3>
        
        {printers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Printer className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Printer topilmadi</p>
            <p className="text-sm">USB, COM yoki tarmoq printerini ulang</p>
          </div>
        ) : (
          <div className="space-y-2">
            {printers.map((printer) => (
              <div
                key={printer.id}
                onClick={() => setSelectedPrinter(printer.id)}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedPrinter === printer.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${
                    printer.type === 'usb' ? 'bg-green-100 text-green-600' :
                    printer.type === 'serial' ? 'bg-purple-100 text-purple-600' :
                    printer.type === 'network' ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {printerTypeIcons[printer.type]}
                  </div>
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      {printer.name}
                      {printer.isDefault && (
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {printer.type.toUpperCase()}
                      {printer.host && ` • ${printer.host}:${printer.port}`}
                      {printer.path && ` • ${printer.path}`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedPrinter === printer.id && (
                    <Check className="w-5 h-5 text-blue-500" />
                  )}
                  {printer.type === 'network' && printer.configured && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => { e.stopPropagation(); removeNetworkPrinter(printer); }}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add network printer */}
        <div className="pt-4 border-t">
          {showNetworkForm ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="IP manzil (192.168.1.100)"
                  value={networkHost}
                  onChange={(e) => setNetworkHost(e.target.value)}
                />
                <Input
                  placeholder="Port (9100)"
                  value={networkPort}
                  onChange={(e) => setNetworkPort(e.target.value)}
                />
                <Input
                  placeholder="Nomi (ixtiyoriy)"
                  value={networkName}
                  onChange={(e) => setNetworkName(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={addNetworkPrinter}>Qo'shish</Button>
                <Button variant="outline" onClick={() => setShowNetworkForm(false)}>Bekor qilish</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setShowNetworkForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Tarmoq printer qo'shish
            </Button>
          )}
        </div>
      </div>


      {/* Actions */}
      <div className="bg-white border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">Amallar</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Button
            onClick={setDefaultPrinter}
            disabled={!selectedPrinter}
            variant="outline"
            className="h-20 flex-col"
          >
            <Star className="w-6 h-6 mb-1" />
            <span className="text-xs">Standart qilish</span>
          </Button>
          
          <Button
            onClick={printTestReceipt}
            disabled={!selectedPrinter || testing}
            variant="outline"
            className="h-20 flex-col"
          >
            <TestTube className={`w-6 h-6 mb-1 ${testing ? 'animate-pulse' : ''}`} />
            <span className="text-xs">Test chek</span>
          </Button>
          
          <Button
            onClick={printReceipt}
            disabled={!selectedPrinter || testing}
            className="h-20 flex-col bg-green-600 hover:bg-green-700"
          >
            <Printer className={`w-6 h-6 mb-1 ${testing ? 'animate-pulse' : ''}`} />
            <span className="text-xs">Chek chop etish</span>
          </Button>
          
          <Button
            onClick={openCashDrawer}
            disabled={!selectedPrinter}
            variant="outline"
            className="h-20 flex-col"
          >
            <DollarSign className="w-6 h-6 mb-1" />
            <span className="text-xs">Kassa ochish</span>
          </Button>
          
          <Button
            onClick={printLabel}
            disabled={!selectedPrinter || testing}
            className="h-20 flex-col bg-amber-600 hover:bg-amber-700"
          >
            <Printer className={`w-6 h-6 mb-1 ${testing ? 'animate-pulse' : ''}`} />
            <span className="text-xs">Senik chop etish</span>
          </Button>
        </div>
      </div>

      {/* Receipt preview */}
      <div className="bg-white border rounded-lg p-4">
        <h3 className="font-semibold mb-4">Chek namunasi</h3>
        
        <div className="max-w-xs mx-auto bg-gray-50 border rounded p-4 font-mono text-sm">
          <div className="text-center font-bold text-lg mb-2">DO'KON NOMI</div>
          <div className="text-center text-xs mb-3">Manzil: Toshkent sh.</div>
          <div className="border-t border-dashed pt-2 mb-2">
            {testItems.map((item, idx) => (
              <div key={idx} className="flex justify-between text-xs mb-1">
                <span>{item.name}</span>
                <span>{item.qty} x {item.price.toLocaleString()}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed pt-2">
            <div className="flex justify-between text-xs">
              <span>Jami:</span>
              <span>{testItems.reduce((s, i) => s + i.qty * i.price, 0).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs text-red-600">
              <span>Chegirma:</span>
              <span>-5,000</span>
            </div>
            <div className="flex justify-between font-bold mt-1">
              <span>JAMI:</span>
              <span>{(testItems.reduce((s, i) => s + i.qty * i.price, 0) - 5000).toLocaleString()}</span>
            </div>
          </div>
          <div className="border-t border-dashed pt-2 mt-2 text-xs">
            <div className="flex justify-between">
              <span>To'lov:</span>
              <span>Naqd</span>
            </div>
            <div className="flex justify-between">
              <span>Qabul qilindi:</span>
              <span>100,000</span>
            </div>
            <div className="flex justify-between">
              <span>Qaytim:</span>
              <span>{(100000 - (testItems.reduce((s, i) => s + i.qty * i.price, 0) - 5000)).toLocaleString()}</span>
            </div>
          </div>
          <div className="text-center mt-3 text-xs">
            <div className="bg-gray-200 h-12 flex items-center justify-center mb-1">
              [BARCODE]
            </div>
            <div>1234567890123</div>
          </div>
          <div className="text-center mt-3 text-xs text-gray-600">
            Xaridingiz uchun rahmat!
          </div>
          <div className="text-center text-xs text-gray-400 mt-2">
            {new Date().toLocaleString('ru-RU')}
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          Qo'llanma
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• USB printer ulanganda avtomatik aniqlanadi</li>
          <li>• COM (Serial) portlar ham aniqlanadi</li>
          <li>• Tarmoq printer uchun IP manzil va port kiriting (standart: 9100)</li>
          <li>• "Standart qilish" tugmasi bilan tanlangan printerni saqlang</li>
          <li>• Qo'llab-quvvatlanadigan printerlar: Xprinter, Rongta, Sunmi, Epson, POS-80, SENIK va boshqalar</li>
        </ul>
      </div>
    </div>
  );
}
