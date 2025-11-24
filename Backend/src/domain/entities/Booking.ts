export interface Booking {
  userId: string;
  hotelId: string;
  checkIn: Date;
  checkOut: Date;
  roomNumber: number;
  status: "PENDING" | "PAID";
}

