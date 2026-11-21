'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton({
  children,
  className,
  pendingLabel = 'Saving…',
  confirm,
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
  confirm?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(event) => {
        if (confirm && !window.confirm(confirm)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
