import { NextResponse } from "next/server"

export function apiSuccess(data, message = "Success", status = 200, headers) {
  return NextResponse.json(
    { status: true, message, ...(data === undefined ? {} : { data }) },
    { status, headers },
  )
}

export function apiError(message, status = 500, details, headers) {
  return NextResponse.json(
    {
      status: false,
      message,
      ...(details === undefined ? {} : { details }),
    },
    { status, headers },
  )
}
