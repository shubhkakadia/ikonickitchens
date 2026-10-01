// Thrown inside a stock transaction to abort it (rolling everything
// back) and report a client error with an HTTP status.
export class TransactionError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export function transactionErrorResponse(error, NextResponse) {
  return NextResponse.json(
    { status: false, message: error.message, data: error.data },
    { status: error.status },
  );
}
