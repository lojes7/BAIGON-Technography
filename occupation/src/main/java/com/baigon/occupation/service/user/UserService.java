// 百工谱 — 通用用户查询业务层
package com.baigon.occupation.service.user;

import com.baigon.occupation.entity.user.User;
import com.baigon.occupation.repository.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

@Service
@Transactional(readOnly = true)
public class UserService {

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

    private UserData userData(User user) {
        return new UserData(
                user.getId(), user.getUid(), user.getName(), user.getRole(), user.getStatus(),
                user.getUniversityId(), user.getSchoolId(), user.getDepartmentId(),
                user.getUniversity() == null ? null : user.getUniversity().getName(),
                user.getSchool() == null ? null : user.getSchool().getName(),
                user.getDepartment() == null ? null : user.getDepartment().getName());
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
            Long departmentId,
            String universityName,
            String schoolName,
            String departmentName) {
    }
}
