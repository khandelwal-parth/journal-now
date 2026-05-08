export const metadata = {
  title: 'My Journal.',
  description: 'Your private personal journal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
