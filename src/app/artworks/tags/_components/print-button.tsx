'use client';

import { Button } from '@kit/ui/button';

export function PrintButton() {
  const handlePrint = () => {
    window.print();
  };

  return (
    <Button
      onClick={handlePrint}
      className="bg-wine text-parchment hover:bg-wine/90 font-serif"
    >
      Print Tags
    </Button>
  );
}


