import * as principalAcademicService from "../services/principal-academic.service.js";

/**
 * GET /api/principal/academic-structure
 * Provides high-level aggregate academic and teaching structure for Principal / Leadership oversight.
 */
export async function getAcademicStructureController(req, res, next) {
  try {
    const data = await principalAcademicService.getAcademicStructure();
    return res.status(200).json({
      success: true,
      message: "Lấy dữ liệu cơ cấu chuyên môn thành công.",
      data,
    });
  } catch (err) {
    next(err);
  }
}
