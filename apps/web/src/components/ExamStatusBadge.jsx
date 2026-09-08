import React from "react";
import Badge from "./ui/Badge";
import { formatExamStatus } from "../utils/enum-map";
import { FileEdit, CheckCircle2, Lock, Archive } from "lucide-react";

export default function ExamStatusBadge({ status, size = "md" }) {
  let variant = "gray";
  let Icon = FileEdit;

  switch (status) {
    case "PUBLISHED":
      variant = "emerald";
      Icon = CheckCircle2;
      break;
    case "CLOSED":
      variant = "gray";
      Icon = Lock;
      break;
    case "ARCHIVED":
      variant = "purple";
      Icon = Archive;
      break;
    case "DRAFT":
    default:
      variant = "amber";
      Icon = FileEdit;
      break;
  }

  return (
    <Badge variant={variant} size={size} icon={Icon}>
      {formatExamStatus(status)}
    </Badge>
  );
}
