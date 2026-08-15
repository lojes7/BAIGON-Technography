// 百工谱 — 岗位分析任务查询服务
package com.baigon.occupation.service.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class JobAnalysisQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final JobAnalysisTaskRepository taskRepository;
    private final JobAnalysisCandidateRepository candidateRepository;
    private final JobAnalysisResultRepository resultRepository;

    public JobAnalysisQueryService(JobAnalysisTaskRepository taskRepository,
                                   JobAnalysisCandidateRepository candidateRepository,
                                   JobAnalysisResultRepository resultRepository) {
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
        this.resultRepository = resultRepository;
    }

    public Page<JobAnalysisTask> list(int page, int pageSize, String reviewStatus) {
        if (page < 0) throw new IllegalArgumentException("page must be >= 0");
        int size = pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        if (reviewStatus == null || reviewStatus.isBlank()) {
            return taskRepository.findByDeletedAtIsNull(pageable);
        }
        return taskRepository.findByReviewStatusAndDeletedAtIsNull(
                ReviewStatus.valueOf(reviewStatus.toUpperCase()), pageable);
    }

    public Optional<JobAnalysisDetail> detail(Long id) {
        return taskRepository.findByIdAndDeletedAtIsNull(id).map(task -> new JobAnalysisDetail(
                task,
                candidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(id),
                resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(id)));
    }

    public record JobAnalysisDetail(JobAnalysisTask task,
                                    List<JobAnalysisCandidate> candidates,
                                    List<JobAnalysisResult> results) {
    }
}
