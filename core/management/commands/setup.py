"""
一键初始化命令：python manage.py setup
自动完成 migrate + 创建管理员 + 种子数据
"""
from django.core.management.base import BaseCommand
from django.core.management import call_command
from core.models import User, Announcement, Member, Award
import datetime


class Command(BaseCommand):
    help = '一键初始化：数据库迁移 + 管理员账号 + 示例数据'

    def handle(self, **options):
        self.stdout.write('=' * 50)
        self.stdout.write('  电子科学与技术协会网站 — 初始化')
        self.stdout.write('=' * 50)

        # 1. 数据库迁移
        self.stdout.write('\n[1/3] 执行数据库迁移...')
        call_command('migrate', '--noinput', verbosity=0)
        self.stdout.write('  ✓ 数据库迁移完成')

        # 2. 创建管理员
        self.stdout.write('\n[2/3] 创建管理员账号...')
        if User.objects.filter(username='admin').exists():
            self.stdout.write('  ✓ 管理员账号已存在 (admin / admin123)')
        else:
            User.objects.create_superuser(
                username='admin',
                password='admin123',
                display_name='管理员',
                role='admin',
            )
            self.stdout.write('  ✓ 管理员已创建 (admin / admin123)')

        # 3. 种子数据
        self.stdout.write('\n[3/3] 写入示例数据...')
        count = 0

        if not Announcement.objects.exists():
            Announcement.objects.create(
                title='欢迎访问电子科学与技术协会',
                content='<p>电子科学与技术协会致力于为同学们提供<strong>电子技术学习与交流</strong>的平台。欢迎新同学加入我们！</p><p>协会拥有丰富的学习资源和项目经验，涵盖嵌入式开发、PCB设计、模拟电路等多个方向。</p>',
                category='news', is_published=True)
            Announcement.objects.create(
                title='2026春季课程安排',
                content='<p>本学期课程安排如下：</p><ol><li>单片机基础（STM32）— 每周二晚</li><li>PCB设计与制作 — 每周三晚</li><li>模拟电路实践 — 每周四晚</li></ol><p>请各位成员按时参加，上课地点在实验楼A301。</p>',
                category='course', is_published=True)
            Announcement.objects.create(
                title='协会招新公告',
                content='<p>电子科学与技术协会<strong>2026年春季招新</strong>正式开始！</p><p>我们欢迎所有对电子技术感兴趣的同学加入。不限专业、不限年级，只要你有热情！</p><p>报名方式：扫描下方二维码或前往实验楼A302现场报名。</p>',
                category='news', is_published=True)
            count += 3

        if not Member.objects.exists():
            Member.objects.create(
                name='张三', position='会长',
                bio='电子科学与技术专业大三学生，负责协会整体运营。擅长嵌入式系统开发，曾获全国大学生电子设计竞赛一等奖。',
                contact='zhangsan@esta.edu.cn', contact_public=True,
                skills='STM32, PCB设计, 嵌入式Linux, FreeRTOS',
                joined_at='2024-09', order=1)
            Member.objects.create(
                name='李四', position='技术部长',
                bio='电子信息工程专业大二学生，主管技术培训和项目开发。精通FPGA和模拟电路设计，带领团队完成多个创新项目。',
                contact='lisi@esta.edu.cn', contact_public=True,
                skills='FPGA, Verilog, 模拟电路, 信号处理',
                joined_at='2024-09', order=2)
            Member.objects.create(
                name='王五', position='副技术部长',
                bio='通信工程专业大二学生，专注于嵌入式软件开发和物联网应用。负责协会代码仓库维护。',
                contact='wangwu@esta.edu.cn', contact_public=False,
                skills='嵌入式开发, Python, C/C++, RTOS, MQTT',
                joined_at='2024-09', order=3)
            count += 3

        if not Award.objects.exists():
            a1 = Award.objects.create(
                title='便携式心电监测仪',
                competition='全国大学生电子设计竞赛',
                rank='first', award_date=datetime.date(2025, 8, 20),
                description='基于STM32的便携式心电信号采集与无线传输系统，获全国一等奖。')
            a1.members.add(Member.objects.get(name='张三'))
            a1.members.add(Member.objects.get(name='李四'))

            a2 = Award.objects.create(
                title='智能农业灌溉系统',
                competition='挑战杯大学生课外学术科技作品竞赛',
                rank='second', award_date=datetime.date(2025, 5, 15),
                description='基于物联网的精准农业灌溉控制系统，获省级二等奖。')
            a2.members.add(Member.objects.get(name='李四'))

            a3 = Award.objects.create(
                title='基于FPGA的图像识别加速器',
                competition='全国大学生FPGA创新设计竞赛',
                rank='third', award_date=datetime.date(2024, 11, 10),
                description='使用Verilog实现卷积神经网络硬件加速，获全国三等奖。')
            a3.members.add(Member.objects.get(name='李四'))
            a3.members.add(Member.objects.get(name='王五'))
            count += 3

        self.stdout.write(f'  ✓ 已写入 {count} 条示例数据')

        self.stdout.write('\n' + '=' * 50)
        self.stdout.write('  初始化完成！')
        self.stdout.write(f'  管理员: admin / admin123')
        self.stdout.write(f'  启动命令: python manage.py runserver')
        self.stdout.write('  访问地址: http://127.0.0.1:8000')
        self.stdout.write('=' * 50)
