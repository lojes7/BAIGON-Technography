// 百工谱 — 通用用户查询业务层
package com.baigon.occupation.service.user;

import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.repository.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class UserService {

    private static final int MAX_BATCH_SIZE = 200;

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /** 查询未软删除用户 */
    public Optional<UserData> getUser(long userId) {
        if (userId <= 0) {
            throw new IllegalArgumentException("user_id must be > 0");
        }
        return userRepository.findByIdAndDeletedAtIsNull(userId).map(this::userData);
    }

    /** ADMIN 按请求顺序批量查询用户详情。 */
    public List<UserData> batchGetUsers(Collection<Long> userIds) {
        List<Long> ids = validatedIds(userIds);
        Map<Long, User> usersById = new LinkedHashMap<>();
        userRepository.findByIdInAndDeletedAtIsNull(ids)
                .forEach(user -> usersById.put(user.getId(), user));
        return ids.stream()
                .distinct()
                .map(usersById::get)
                .filter(java.util.Objects::nonNull)
                .map(this::userData)
                .toList();
    }

    private UserData userData(User user) {
        return new UserData(
                user.getId(), user.getUid(), user.getName(), user.getRole(), user.getStatus(),
                user.getUniversityId(), user.getSchoolId(), user.getDepartmentId());
    }

    private List<Long> validatedIds(Collection<Long> values) {
        if (values == null || values.isEmpty()) {
            throw new IllegalArgumentException("ids must not be empty");
        }
        if (values.size() > MAX_BATCH_SIZE) {
            throw new IllegalArgumentException("ids must contain at most 200 values");
        }
        List<Long> ids = List.copyOf(values);
        if (ids.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new IllegalArgumentException("ids must contain positive values");
        }
        // 在仓库查询前去重，并保持首次出现顺序。
        return ids.stream().distinct().toList();
    }

    /** 用户对外可见数据，不包含密码。 */
    public record UserData(
            Long id,
            String uid,
            String name,
            User.Role role,
            User.UserStatus status,
            Long universityId,
            Long schoolId,
            Long departmentId) {
    }
}
