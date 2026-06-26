"use client";

export default function PayPage() {
  const handlePay = async () => {
    const res = await fetch("/api/payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "ORDER-123",
        amount: 50000,
        name: "John Doe",
        email: "john@mail.com",
      }),
    });

    const data = await res.json();

    if (!data.token) {
      alert("Failed to get token");
      return;
    }

    window.snap.pay(data.token, {
      onSuccess: (res) => console.log("Success:", res),
      onPending: (res) => console.log("Pending:", res),
      onError: (res) => console.log("Error:", res),
      onClose: () => alert("Popup closed"),
    });
  };

  return (
    <button onClick={handlePay} className="btn">
      Bayar Sekarang
    </button>
  );
}
