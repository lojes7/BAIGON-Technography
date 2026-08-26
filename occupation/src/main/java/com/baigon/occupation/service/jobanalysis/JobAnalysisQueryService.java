// 百工谱 — 岗位分析任务查询服务
package com.baigon.occupation.service.jobanalysis;

import com.baigon.occupation.entity.jobanalysis.JobAnalysisCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisMajorCandidate;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisResult;
import com.baigon.occupation.entity.ReviewStatus;
import com.baigon.occupation.entity.jobanalysis.JobAnalysisTask;
import com.baigon.occupation.entity.major.Major;
import com.baigon.occupation.entity.occupation.Occupation;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisMajorCandidateRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisResultRepository;
import com.baigon.occupation.repository.jobanalysis.JobAnalysisTaskRepository;
import com.baigon.occupation.repository.major.MajorRepository;
import com.baigon.occupation.repository.occupation.OccupationRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional(readOnly = true)
public class JobAnalysisQueryService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final JobAnalysisTaskRepository taskRepository;
    private final JobAnalysisCandidateRepository candidateRepository;
    private final JobAnalysisMajorCandidateRepository majorCandidateRepository;
    private final JobAnalysisResultRepository resultRepository;
    private final OccupationRepository occupationRepository;
    private final MajorRepository majorRepository;

    public JobAnalysisQueryService(JobAnalysisTaskRepository taskRepository,
                                   JobAnalysisCandidateRepository candidateRepository,
                                   JobAnalysisMajorCandidateRepository majorCandidateRepository,
                                   JobAnalysisResultRepository resultRepository,
                                   OccupationRepository occupationRepository,
                                   MajorRepository majorRepository) {
        this.taskRepository = taskRepository;
        this.candidateRepository = candidateRepository;
        this.majorCandidateRepository = majorCandidateRepository;
        this.resultRepository = resultRepository;
        this.occupationRepository = occupationRepository;
        this.majorRepository = majorRepository;
    }

    public Page<JobAnalysisTaskView> list(int page, int pageSize, String reviewStatus) {
        if (page < 0) throw new IllegalArgumentException("page must be >= 0");
        int size = pageSize == 0 ? DEFAULT_PAGE_SIZE : pageSize;
        if (size < 1 || size > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("page_size must be between 1 and 100");
        }
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<JobAnalysisTask> tasks;
        if (reviewStatus == null || reviewStatus.isBlank()) {
            tasks = taskRepository.findByDeletedAtIsNull(pageable);
        } else {
            tasks = taskRepository.findByReviewStatusAndDeletedAtIsNull(
                    ReviewStatus.valueOf(reviewStatus.toUpperCase()), pageable);
        }
        return withSelectedNames(tasks);
    }

    public Optional<JobAnalysisDetail> detail(Long id) {
        return taskRepository.findByIdAndDeletedAtIsNull(id).map(task -> {
            JobAnalysisTaskView summary = withSelectedNames(List.of(task)).getFirst();
            return new JobAnalysisDetail(
                    summary,
                    candidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(id),
                    majorCandidateRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(id),
                    resultRepository.findByTaskIdAndDeletedAtIsNullOrderByRankAsc(id));
        });
    }

    /** 列表批量查询目录名称，避免每条任务各发两次目录查询。 */
    private Page<JobAnalysisTaskView> withSelectedNames(Page<JobAnalysisTask> tasks) {
        List<JobAnalysisTaskView> summaries = withSelectedNames(tasks.getContent());
        Map<Long, JobAnalysisTaskView> byTaskId = summaries.stream()
                .collect(Collectors.toMap(item -> item.task().getId(), item -> item));
        return tasks.map(task -> byTaskId.get(task.getId()));
    }

    private List<JobAnalysisTaskView> withSelectedNames(List<JobAnalysisTask> tasks) {
        Map<Long, String> occupationNames = occupationNames(tasks);
        Map<Long, String> majorNames = majorNames(tasks);
        return tasks.stream().map(task -> new JobAnalysisTaskView(
                task,
                selectedName(task.getSelectedOccupationId(), occupationNames),
                selectedName(task.getSelectedMajorId(), majorNames))).toList();
    }

    private Map<Long, String> occupationNames(List<JobAnalysisTask> tasks) {
        Set<Long> ids = tasks.stream()
                .map(JobAnalysisTask::getSelectedOccupationId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return occupationRepository.findByIdInAndDeletedAtIsNull(ids).stream()
                .collect(Collectors.toMap(Occupation::getId, Occupation::getName));
    }

    private Map<Long, String> majorNames(List<JobAnalysisTask> tasks) {
        Set<Long> ids = tasks.stream()
                .map(JobAnalysisTask::getSelectedMajorId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) return Map.of();
        return majorRepository.findByIdInAndDeletedAtIsNull(ids).stream()
                .collect(Collectors.toMap(Major::getId, Major::getName));
    }

    private String selectedName(Long id, Map<Long, String> names) {
        return id == null ? "" : names.getOrDefault(id, "");
    }

    public record JobAnalysisTaskView(JobAnalysisTask task,
                                      String selectedOccupationName,
                                      String selectedMajorName) {
    }

    public record JobAnalysisDetail(JobAnalysisTaskView summary,
                                    List<JobAnalysisCandidate> candidates,
                                    List<JobAnalysisMajorCandidate> majorCandidates,
                                    List<JobAnalysisResult> results) {
    }
}
