# ProductStatusModal Component

A modern, clean, and fully responsive product status selector component built with React, TypeScript, and shadcn/ui.

## Features

✨ **Modern Design**
- Clean, polished interface matching your dark theme
- Smooth animations and transitions
- Visual status indicators with icons
- Real-time preview of selected status

📱 **Fully Responsive**
- Seamless experience on desktop and mobile
- Touch-friendly interactions
- Adaptive layout for all screen sizes

♿ **Accessible**
- Keyboard navigation support
- Screen reader friendly
- ARIA labels and semantic HTML

🎨 **Customizable**
- Four predefined status types
- Color-coded badges and icons
- Consistent with shadcn/ui design system

## Installation

The component uses existing shadcn/ui components. Make sure you have these installed:

```bash
# If not already installed
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add select
npx shadcn-ui@latest add label
npx shadcn-ui@latest add button
npx shadcn-ui@latest add badge
```

## Usage

### Basic Example

```tsx
import { ProductStatusModal, ProductStatus } from "@/components/ProductStatusModal";
import { Button } from "@/components/ui/button";

function MyComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<ProductStatus>("available");

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        Update Status
      </Button>

      <ProductStatusModal
        open={isOpen}
        onOpenChange={setIsOpen}
        currentStatus={status}
        onStatusChange={setStatus}
        productName="Wireless Headphones"
      />
    </>
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `open` | `boolean` | Yes | Controls modal visibility |
| `onOpenChange` | `(open: boolean) => void` | Yes | Callback when modal open state changes |
| `currentStatus` | `ProductStatus` | No | Current product status (default: "available") |
| `onStatusChange` | `(status: ProductStatus) => void` | Yes | Callback when status is saved |
| `productName` | `string` | No | Product name to display in modal |

## Status Types

The component supports four status types:

### Available
- **Icon:** CheckCircle2
- **Color:** Green
- **Description:** Product is in stock and ready to sell

### Pending
- **Icon:** Clock
- **Color:** Yellow
- **Description:** Product is being processed or restocked

### Out of Stock
- **Icon:** XCircle
- **Color:** Orange
- **Description:** Product is temporarily unavailable

### Discontinued
- **Icon:** Package
- **Color:** Red
- **Description:** Product is no longer available

## Customization

### Adding New Status Types

Edit the `statusConfig` object in `ProductStatusModal.tsx`:

```tsx
const statusConfig = {
  "your-status": {
    label: "Your Status",
    description: "Description of your status",
    icon: YourIcon,
    color: "text-blue-500",
    badgeVariant: "default" as const,
  },
  // ... existing statuses
};
```

### Styling

The component uses Tailwind CSS and CSS variables from your theme. Customize colors in `global.css`:

```css
@theme {
  --color-primary: hsl(0 72% 51%);
  /* ... other colors */
}
```

## Demo

Run the demo page to see the component in action:

```tsx
import ProductStatusDemo from "@/pages/ProductStatusDemo";

// Add to your router
<Route path="/demo" element={<ProductStatusDemo />} />
```

## Responsive Behavior

### Desktop (≥640px)
- Modal width: 500px max
- Two-column button layout in footer
- Larger text and spacing

### Mobile (<640px)
- Full-width modal with padding
- Stacked button layout
- Touch-optimized tap targets
- Reduced spacing for compact view

## Accessibility

- **Keyboard Navigation:** Tab through elements, Enter to select, Escape to close
- **Screen Readers:** Proper ARIA labels and descriptions
- **Focus Management:** Automatic focus trapping in modal
- **Color Contrast:** WCAG AA compliant color ratios

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## TypeScript

Full TypeScript support with exported types:

```tsx
import { ProductStatus } from "@/components/ProductStatusModal";

type ProductStatus = "available" | "pending" | "out-of-stock" | "discontinued";
```

## Examples

See `ProductStatusModal.example.tsx` for more usage examples:
- Basic usage
- Form integration
- API integration
- Bulk updates
- Validation

## License

Part of your project - use as needed!
