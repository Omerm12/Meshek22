/**
 * The printable picking sheet for one order — warehouse-facing, not
 * customer-facing. Deliberately excludes prices, payment/CardCom detail,
 * promotion breakdowns and any internal ids/tokens; a picker only needs to
 * know what to grab and where it's going.
 *
 * Rendered `hidden print:block`: invisible during normal browsing, and the
 * only thing left on the page once @media print takes over (see
 * PrintPickingSheetButton and AdminShell, which hide everything else).
 */

export interface PickingSheetItem {
  id: string;
  productName: string;
  variantLabel: string;
  quantity: number;
}

export interface PickingSheetProps {
  orderNumber: string;
  orderDate: string;
  customerName?: string | null;
  customerPhone?: string | null;
  isPickup: boolean;
  pickupLocationName?: string;
  city?: string | null;
  fullAddress?: string | null;
  deliveryNotes?: string | null;
  requestedDeliveryDate?: string | null;
  confirmedDeliveryDate?: string | null;
  items: PickingSheetItem[];
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <span className="font-semibold">{label}: </span>
      {value}
    </div>
  );
}

export function PickingSheet({
  orderNumber,
  orderDate,
  customerName,
  customerPhone,
  isPickup,
  pickupLocationName,
  city,
  fullAddress,
  deliveryNotes,
  requestedDeliveryDate,
  confirmedDeliveryDate,
  items,
}: PickingSheetProps) {
  return (
    <div className="picking-sheet hidden print:block text-black bg-white p-6" dir="rtl">
      <header className="mb-6 border-b-2 border-black pb-4">
        <p className="text-lg font-bold">משק 22</p>
        <h1 className="text-2xl font-bold mt-1">דף ליקוט להזמנה</h1>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
        <Field label="מספר הזמנה" value={orderNumber} />
        <Field label="תאריך הזמנה" value={orderDate} />
        <Field label="שם לקוח" value={customerName || "—"} />
        <Field label="טלפון" value={customerPhone || "—"} />

        {isPickup ? (
          <div className="col-span-2">
            <span className="font-semibold">אופן קבלה: </span>
            איסוף עצמי — {pickupLocationName}
          </div>
        ) : (
          <>
            <Field label="עיר" value={city || "—"} />
            <Field label="כתובת מלאה" value={fullAddress || "—"} />
          </>
        )}

        {deliveryNotes && (
          <div className="col-span-2">
            <Field label="הערות משלוח" value={deliveryNotes} />
          </div>
        )}
        {requestedDeliveryDate && <Field label="תאריך מבוקש" value={requestedDeliveryDate} />}
        {confirmedDeliveryDate && <Field label="תאריך מאושר" value={confirmedDeliveryDate} />}
      </section>

      <table className="picking-sheet-table text-sm">
        <colgroup>
          <col className="picking-sheet-col-check" />
          <col className="picking-sheet-col-product" />
          <col className="picking-sheet-col-unit" />
          <col className="picking-sheet-col-qty" />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-black">
            <th className="text-start" />
            <th className="text-start">מוצר</th>
            <th className="text-start">יחידה</th>
            <th className="text-center">כמות</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-400">
              <td>
                <span className="inline-block h-4 w-4 border-2 border-black" aria-hidden="true" />
              </td>
              <td>{item.productName}</td>
              <td>{item.variantLabel}</td>
              <td className="picking-sheet-qty">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
