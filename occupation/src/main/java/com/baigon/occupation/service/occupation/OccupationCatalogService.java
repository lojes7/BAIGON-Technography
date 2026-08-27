// 百工谱 — 职业目录查询业务层
package com.baigon.occupation.service.occupation;

import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.entity.occupation.OccupationCategory;
import com.baigon.occupation.entity.occupation.OccupationMajorCategory;
import com.baigon.occupation.entity.occupation.OccupationSubCategory;
import com.baigon.occupation.repository.occupation.OccupationCategoryRepository;
import com.baigon.occupation.repository.occupation.OccupationMajorCategoryRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import com.baigon.occupation.repository.occupation.OccupationSubCategoryRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class OccupationCatalogService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final OccupationMajorCategoryRepository majorCategoryRepository;
    private final OccupationSubCategoryRepository subCategoryRepository;
    private final OccupationCategoryRepository categoryRepository;
    private final OccupationRepository occupationRepository;

    public OccupationCatalogService(OccupationMajorCategoryRepository majorCategoryRepository,
                                    OccupationSubCategoryRepository subCategoryRepository,
                                    OccupationCategoryRepository categoryRepository,
                                    OccupationRepository occupationRepository) {
        this.majorCategoryRepository = majorCategoryRepository;
        this.subCategoryRepository = subCategoryRepository;
        this.categoryRepository = categoryRepository;
        this.occupationRepository = occupationRepository;
    }

    public Page<OccupationMajorCategory> listMajorCategories(int page, int pageSize, String keyword) {
        return majorCategoryRepository.search(keyword(keyword), pageable(page, pageSize));
    }

    public Page<OccupationSubCategory> listSubCategories(long parentId, int page, int pageSize, String keyword) {
        return subCategoryRepository.search(parent(parentId), keyword(keyword), pageable(page, pageSize));
    }

    public Page<OccupationCategory> listCategories(long parentId, int page, int pageSize, String keyword) {
        return categoryRepository.search(parent(parentId), keyword(keyword), pageable(page, pageSize));
    }

    public Page<Occupation> listOccupations(long parentId, int page, int pageSize, String keyword) {
        String normalizedKeyword = keyword(keyword);
        Pageable normalizedPage = pageable(page, pageSize);
        return parentId == 0
                ? occupationRepository.searchAll(normalizedKeyword, normalizedPage)
                : occupationRepository.search(parent(parentId), normalizedKeyword, normalizedPage);
    }

    public int normalizedPageSize(int pageSize) {
        if (pageSize < 0 || pageSize > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        return pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
    }

    private Pageable pageable(int page, int pageSize) {
        if (page < 0) {
            throw new IllegalArgumentException("page must be >= 0");
        }
        return PageRequest.of(page, normalizedPageSize(pageSize), Sort.by(Sort.Direction.ASC, "id"));
    }

    private long parent(long parentId) {
        if (parentId <= 0) {
            throw new IllegalArgumentException("parent_id must be > 0");
        }
        return parentId;
    }

    private String keyword(String keyword) {
        return keyword == null ? "" : keyword.trim();
    }
}
