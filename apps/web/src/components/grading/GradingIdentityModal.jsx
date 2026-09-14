import React from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { CheckCircle2 } from "lucide-react";

export default function GradingIdentityModal({
  isOpen,
  onClose,
  sbdInput,
  setSbdInput,
  identityError,
  isSubmittingIdentity,
  onSave,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận Số báo danh thí sinh"
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmittingIdentity}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={CheckCircle2}
            onClick={onSave}
            loading={isSubmittingIdentity}
          >
            Lưu số báo danh
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1">
        <p className="text-xs text-slate-600">
          Nhập chính xác số báo danh của thí sinh (đúng 6 chữ số). Hành động
          này sẽ được ghi lại trong nhật ký kiểm toán.
        </p>
        <div>
          <label
            htmlFor="sbd-input"
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Số báo danh (6 chữ số)
          </label>
          <input
            id="sbd-input"
            type="text"
            maxLength={6}
            value={sbdInput}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              setSbdInput(val);
            }}
            placeholder="Ví dụ: 000001"
            className="w-full px-3 py-2 text-center text-lg font-mono font-bold tracking-widest rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            autoFocus
          />
        </div>
        {identityError && (
          <Alert variant="danger" className="text-xs">
            {identityError}
          </Alert>
        )}
      </div>
    </Modal>
  );
}
