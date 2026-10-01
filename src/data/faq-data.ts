export interface FaqItem {
  question: string;
  answer: string;
}

export const faqData: FaqItem[] = [
  {
    question: "Why am I getting a certificate error when connecting?",
    answer: "This usually happens when your computer's clock is off by more than 10 seconds. Since Docker containers use your computer's clock, if your system time is wrong, connections will fail.\n\nTo fix this:\n1. Make sure your computer's clock is set to sync automatically (usually via NTP in your system settings)\n2. If you use Docker Desktop, try restarting it, this often fixes time sync issues, especially after your computer has been sleeping\n3. Restart your computer if the issue persists"
  },
  {
    question: "Why is my miner not submitting any shares?",
    answer: "This is usually related to the initial difficulty setting. When you first connect, the system doesn't know how fast your miner is, so it starts with an estimated difficulty that might be too high for your miner to find shares.\n\nDon't worry, the system will automatically adjust. Once it notices your miner isn't finding shares, it will lower the difficulty so your miner can start submitting shares. This is called 'variable difficulty' and it's normal.\n\nIf your miner still isn't submitting shares after a few minutes, check that your miner is properly connected and configured."
  },
  {
    question: "How do I reset a forgotten password?",
    answer: "On the login screen, select Forgot password? and follow these steps:\n\n1. Enter the recovery key you saved when you created your password.\n2. Choose a new password and confirm it.\n3. Save the new recovery key shown after the reset. It replaces your previous recovery key.\n\nYour mining configuration is kept when you reset your password.\n\nIf you have also lost your recovery key, follow the instructions in 'I lost my recovery key. What should I do?' below."
  },
  {
    question: "I lost my recovery key. What should I do?",
    answer: "If you lose your recovery key, you can reset your credentials and generate a new password. This process requires access to the application's filesystem.\n\nThe steps depend on how you are running the Stratum V2 UI.\n\nDevelopment mode\n\nIf you are running the application with npm run dev, delete the credentials file at:\n\n<root_of_the_project>/data/config/credential.json\n\nAfter deleting the file, reload the application. You will be prompted to generate a new password.\n\nDocker\n\nIf you are running the application using the Docker command from stratumprotocol.org, you can delete the credentials file using the Docker CLI:\n\ndocker exec sv2-ui rm -f /app/data/config/credential.json\n\nAfter deleting the file, reload the application. You will be prompted to generate a new password.\n\nUmbrel\n\nIf you are running the application on an Umbrel machine:\n\n1. Go to Settings > Advanced Settings > Terminal.\n2. Select the Stratum V2 UI app.\n3. In the terminal, run:\n\nrm -f /app/data/config/credential.json\n\nAfter deleting the file, reload the application. You will be prompted to generate a new password.\n\nNote: Deleting credential.json resets the stored credentials. Make sure you have access to the filesystem before proceeding."
  }
];
