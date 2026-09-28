import { Suspense } from "react";
import PinForm from "./PinForm";

export default function PinPage() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Suspense fallback={null}>
        <PinForm />
      </Suspense>
    </div>
  );
}
