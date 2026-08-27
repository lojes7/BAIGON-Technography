// 百工谱 — 专业目录查询业务层
package com.baigon.occupation.service.major;

import com.baigon.occupation.entity.major.DisciplineCategory;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.major.MajorCategory;
import com.baigon.occupation.repository.major.DisciplineCategoryRepository;
import com.baigon.occupation.repository.major.MajorCategoryRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class MajorCatalogService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final DisciplineCategoryRepository disciplineRepository;
    private final MajorCategoryRepository majorCategoryRepository;
    private final MajorRepository majorRepository;

    public MajorCatalogService(DisciplineCategoryRepository disciplineRepository,
                               MajorCategoryRepository majorCategoryRepository,
                               MajorRepository majorRepository) {
        this.disciplineRepository = disciplineRepository;
        this.majorCategoryRepository = majorCategoryRepository;
        this.majorRepository = majorRepository;
    }

    public Page<DisciplineCategory> listDisciplineCategories(int page, int pageSize, String keyword) {
        return disciplineRepository.search(keyword(keyword), pageable(page, pageSize));
    }

    public Page<MajorCategory> listMajorCategories(long parentId, int page, int pageSize, String keyword) {
        return majorCategoryRepository.search(parent(parentId), keyword(keyword), pageable(page, pageSize));
    }

    public Page<Major> listMajors(long parentId, int page, int pageSize, String keyword) {
        String normalizedKeyword = keyword(keyword);
        Pageable normalizedPage = pageable(page, pageSize);
        return parentId == 0
                ? majorRepository.searchAll(normalizedKeyword, normalizedPage)
                : majorRepository.search(parent(parentId), normalizedKeyword, normalizedPage);
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
