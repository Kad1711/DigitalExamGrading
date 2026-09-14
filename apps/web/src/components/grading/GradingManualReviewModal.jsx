import React from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Badge from "../ui/Badge";
import Alert from "../ui/Alert";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Check,
  HelpCircle,
} from "lucide-react";

export default function GradingManualReviewModal({
  isOpen,
  onClose,
  reviewQueue = [],
  reviewIndex,
  setReviewIndex,
  safeReviewIndex,
  currentReviewQuestion,
  cropBlobUrls = {},
  reviewOverrides = {},
  setReviewOverrides,
  isSubmittingReview,
  reviewError,
  onApplyReview,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận kết quả bài thi OMR"
      description="Giáo viên xác nhận các câu hỏi trắc nghiệm tô nhiều ô hoặc không chắc chắn."
      maxWidth="max-w-2xl"
      footer={
        <div className="w-full flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={ArrowLeft}
              disabled={safeReviewIndex === 0}
              onClick={() => setReviewIndex((prev) => Math.max(0, prev - 1))}
            >
              Câu trước
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safeReviewIndex === reviewQueue.length - 1}
              onClick={() =>
                setReviewIndex((prev) =>
                  Math.min(reviewQueue.length - 1, prev + 1)
                )
              }
            >
              Câu tiếp <ArrowRight className="w-4 h-4 ml-1 inline" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Đóng
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={CheckCircle2}
              loading={isSubmittingReview}
              disabled={Object.keys(reviewOverrides).length === 0}
              onClick={onApplyReview}
            >
              Xác nhận & Chấm lại ({Object.keys(reviewOverrides).length} câu)
            </Button>
          </div>
        </div>
      }
    >
      {reviewQueue.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          Không có câu hỏi nào cần kiểm tra.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Horizontal Question Navigation Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100">
            {reviewQueue.map((item, idx) => {
              const isCurrent = idx === safeReviewIndex;
              const hasChosen = reviewOverrides[item.questionNumber] !== undefined;
              const isResolved = item.resolvedByTeacher;

              return (
                <button
                  key={item.questionNumber}
                  type="button"
                  onClick={() => setReviewIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isCurrent
                      ? "bg-blue-600 text-white shadow-xs ring-2 ring-blue-200"
                      : hasChosen || isResolved
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-300 hover:bg-emerald-100"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  <span>Câu {item.questionNumber}</span>
                  {(hasChosen || isResolved) && (
                    <Check className="w-3 h-3 text-emerald-600" />
                  )}
                </button>
              );
            })}
          </div>

          {currentReviewQuestion && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900">
                    Câu {currentReviewQuestion.questionNumber}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({safeReviewIndex + 1} / {reviewQueue.length} câu cần duyệt)
                  </span>
                </div>
                <div>
                  {(() => {
                    const overrideVal = reviewOverrides[currentReviewQuestion.questionNumber];
                    const resType = overrideVal
                      ? overrideVal.resolution
                      : currentReviewQuestion.teacherResolution;
                    const resAns = overrideVal
                      ? overrideVal.answer
                      : currentReviewQuestion.resolvedAnswer;

                    if (currentReviewQuestion.resolvedByTeacher || overrideVal) {
                      if (resType === "MULTIPLE_INVALID") {
                        return (
                          <Badge variant="red" size="sm">
                            GV đã chọn: Tô nhiều ô / K.hợp lệ (0đ)
                          </Badge>
                        );
                      }
                      if (resType === "BLANK") {
                        return (
                          <Badge variant="gray" size="sm">
                            GV đã chọn: Bỏ trống (0đ)
                          </Badge>
                        );
                      }
                      if (resType === "ANSWER") {
                        return (
                          <Badge variant="blue" size="sm">
                            GV đã chọn: Phương án {resAns}
                          </Badge>
                        );
                      }
                      if (resType === "UNRESOLVED") {
                        return (
                          <Badge variant="amber" size="sm">
                            Chưa thể xác định
                          </Badge>
                        );
                      }
                    }

                    if (currentReviewQuestion.omrStatus === "MULTIPLE") {
                      return (
                        <Badge variant="purple" size="sm">
                          Tô nhiều ô (
                          {currentReviewQuestion.candidates?.join(", ") ||
                            currentReviewQuestion.candidate ||
                            ""}
                          )
                        </Badge>
                      );
                    }
                    return (
                      <Badge variant="amber" size="sm">
                        Không chắc chắn / Mờ
                      </Badge>
                    );
                  })()}
                </div>
              </div>

              {/* Crop Image Display */}
              {(cropBlobUrls[currentReviewQuestion.questionNumber] ||
                currentReviewQuestion.reviewCropDataUrl) ? (
                <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 flex flex-col items-center justify-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Ảnh trích xuất vùng câu {currentReviewQuestion.questionNumber}
                  </span>
                  <img
                    src={
                      cropBlobUrls[currentReviewQuestion.questionNumber] ||
                      currentReviewQuestion.reviewCropDataUrl
                    }
                    alt={`Vùng tô câu ${currentReviewQuestion.questionNumber}`}
                    className="max-h-24 w-auto rounded-lg border border-slate-300 shadow-xs bg-white object-contain"
                  />
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500 text-center">
                  (Không có ảnh trích xuất cho câu này)
                </div>
              )}

              {/* Objectivity Note & AI Detection Suggestion */}
              <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200/60 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-amber-950">
                  <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                  Đáp án chính thức bị ẩn nhằm đảm bảo tính khách quan của giáo viên.
                </div>
                {currentReviewQuestion.candidate && (
                  <p className="text-[11px] text-amber-800">
                    Gợi ý nhận diện AI:{" "}
                    <strong>{currentReviewQuestion.candidate}</strong> (độ tin cậy{" "}
                    {(currentReviewQuestion.confidence * 100).toFixed(0)}%)
                  </p>
                )}
              </div>

              {/* Teacher Selection Buttons */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    1. Xác nhận 1 đáp án hợp lệ duy nhất:
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {["A", "B", "C", "D"].map((opt) => {
                      const overrideVal = reviewOverrides[currentReviewQuestion.questionNumber];
                      const isSelected =
                        overrideVal !== undefined
                          ? overrideVal.resolution === "ANSWER" && overrideVal.answer === opt
                          : currentReviewQuestion.resolvedByTeacher &&
                            currentReviewQuestion.teacherResolution === "ANSWER" &&
                            currentReviewQuestion.resolvedAnswer === opt;

                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setReviewOverrides((prev) => ({
                              ...prev,
                              [currentReviewQuestion.questionNumber]: {
                                resolution: "ANSWER",
                                answer: opt,
                              },
                            }));
                          }}
                          className={`py-3 px-4 rounded-xl font-bold text-base border-2 transition-all flex items-center justify-center cursor-pointer ${
                            isSelected
                              ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200"
                              : "bg-white text-slate-800 border-slate-200 hover:border-blue-400 hover:bg-blue-50/30"
                          }`}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200/80">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    2. Hoặc xác nhận trạng thái đặc biệt khác:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* BLANK */}
                    {(() => {
                      const overrideVal = reviewOverrides[currentReviewQuestion.questionNumber];
                      const isSelected =
                        overrideVal !== undefined
                          ? overrideVal.resolution === "BLANK"
                          : currentReviewQuestion.resolvedByTeacher &&
                            currentReviewQuestion.teacherResolution === "BLANK";
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewOverrides((prev) => ({
                              ...prev,
                              [currentReviewQuestion.questionNumber]: {
                                resolution: "BLANK",
                              },
                            }));
                          }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                            isSelected
                              ? "bg-slate-800 text-white border-slate-800 shadow-xs ring-2 ring-slate-300"
                              : "bg-white text-slate-700 border-slate-200 hover:border-slate-400 hover:bg-slate-50"
                          }`}
                        >
                          <span>Học sinh để trống</span>
                          <span className="text-[10px] opacity-75 font-normal">
                            (0 điểm)
                          </span>
                        </button>
                      );
                    })()}

                    {/* MULTIPLE_INVALID */}
                    {(() => {
                      const overrideVal = reviewOverrides[currentReviewQuestion.questionNumber];
                      const isSelected =
                        overrideVal !== undefined
                          ? overrideVal.resolution === "MULTIPLE_INVALID"
                          : currentReviewQuestion.resolvedByTeacher &&
                            currentReviewQuestion.teacherResolution === "MULTIPLE_INVALID";
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewOverrides((prev) => ({
                              ...prev,
                              [currentReviewQuestion.questionNumber]: {
                                resolution: "MULTIPLE_INVALID",
                              },
                            }));
                          }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                            isSelected
                              ? "bg-rose-700 text-white border-rose-700 shadow-xs ring-2 ring-rose-300"
                              : "bg-white text-rose-700 border-rose-200 hover:border-rose-400 hover:bg-rose-50/40"
                          }`}
                        >
                          <span>Tô nhiều ô / Không hợp lệ</span>
                          <span className="text-[10px] opacity-75 font-normal">
                            (0 điểm)
                          </span>
                        </button>
                      );
                    })()}

                    {/* UNRESOLVED */}
                    {(() => {
                      const overrideVal = reviewOverrides[currentReviewQuestion.questionNumber];
                      const isSelected =
                        overrideVal !== undefined
                          ? overrideVal.resolution === "UNRESOLVED"
                          : currentReviewQuestion.teacherResolution === "UNRESOLVED";
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setReviewOverrides((prev) => ({
                              ...prev,
                              [currentReviewQuestion.questionNumber]: {
                                resolution: "UNRESOLVED",
                              },
                            }));
                          }}
                          className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center justify-center text-center cursor-pointer ${
                            isSelected
                              ? "bg-amber-600 text-white border-amber-600 shadow-xs ring-2 ring-amber-200"
                              : "bg-white text-amber-800 border-amber-200 hover:border-amber-400 hover:bg-amber-50/40"
                          }`}
                        >
                          <span>Chưa thể xác định</span>
                          <span className="text-[10px] opacity-75 font-normal">
                            (Giữ tạm tính)
                          </span>
                        </button>
                      );
                    })()}
                  </div>
                </div>

                {(reviewOverrides[currentReviewQuestion.questionNumber] !== undefined ||
                  currentReviewQuestion.resolvedByTeacher) && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setReviewOverrides((prev) => {
                          const next = { ...prev };
                          delete next[currentReviewQuestion.questionNumber];
                          return next;
                        });
                      }}
                      className="text-xs text-slate-500 hover:text-rose-600 underline cursor-pointer"
                    >
                      Xóa lựa chọn cho câu này
                    </button>
                  </div>
                )}
              </div>

              {reviewError && (
                <Alert variant="danger" className="text-xs">
                  {reviewError}
                </Alert>
              )}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
