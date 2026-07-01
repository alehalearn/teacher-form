import './globals.css';

export const metadata = {
  title: 'ALEHA TEACHER — Registration',
  description: 'Teacher registration portal for ALEHA TEACHER',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}