import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './alert';

interface ConnectionAlertProps {
  isOrchestrated: boolean;
  className?: string;
}

export function ConnectionAlert({ isOrchestrated, className }: ConnectionAlertProps) {
  return (
    <Alert variant="destructive" className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Backend error</AlertTitle>
      <AlertDescription>
        {isOrchestrated
          ? "The backend returned an error (5xx). Showing the last known status."
          : "The backend returned an error (5xx). Showing standalone view."}
      </AlertDescription>
    </Alert>
  );
}
